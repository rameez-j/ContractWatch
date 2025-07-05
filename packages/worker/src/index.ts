import { ethers } from "ethers";
import { connect as connectNats } from "nats";
import { Client } from "pg";
import pino from "pino";

const logger = pino({ name: "contract-watch-worker" });

interface DeploymentEvent {
  ts: string;
  wallet: string;
  contract: string;
  network: string;
  txHash: string;
  gas: string;
}

async function main() {
  try {
    // Initialize connections
    logger.info("Initializing connections...");
    
    const nats = await connectNats({ 
      servers: process.env.NATS_URL || "nats://localhost:4222" 
    });
    
    const pg = new Client({ 
      connectionString: process.env.DATABASE_URL || "postgres://postgres:secret@localhost:5432/contractwatch"
    });
    await pg.connect();
    
    logger.info("Connected to NATS and PostgreSQL");

    // Initialize database schema
    await initializeDatabase(pg);

    // Get networks to monitor
    const networks = (process.env.NETWORKS || "sepolia").split(",");
    
    for (const network of networks) {
      await startNetworkMonitoring(network.trim(), nats, pg);
    }

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      logger.info("Shutting down gracefully...");
      await nats.close();
      await pg.end();
      process.exit(0);
    });

  } catch (error) {
    logger.error("Failed to start worker:", error);
    process.exit(1);
  }
}

async function initializeDatabase(pg: Client) {
  // Create tables if they don't exist
  await pg.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    CREATE TABLE IF NOT EXISTS wallets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID,
      address TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS deployments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ts TIMESTAMP NOT NULL,
      wallet_id UUID REFERENCES wallets(id),
      network TEXT NOT NULL,
      contract_address TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      gas_used BIGINT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_deployments_wallet_id ON deployments(wallet_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_ts ON deployments(ts);
    CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
  `);
  
  logger.info("Database schema initialized");
}

async function startNetworkMonitoring(network: string, nats: any, pg: Client) {
  const providerUrl = getProviderUrl(network);
  if (!providerUrl) {
    logger.warn(`Skipping unknown network: ${network}`);
    return;
  }

  logger.info(`Starting monitoring for network: ${network}`);
  
  const provider = new ethers.WebSocketProvider(providerUrl);
  
  provider.on("error", (error) => {
    logger.error(`Provider error for ${network}:`, error);
  });

  provider.on("block", async (blockNum) => {
    try {
      logger.debug(`New block ${blockNum} on ${network}`);
      
      const block = await provider.getBlockWithTransactions(blockNum);
      
      for (const tx of block.transactions) {
        // Check if this is a contract deployment (tx.to is null)
        if (!tx.to) {
          await processContractDeployment(tx, network, nats, pg, provider);
        }
      }
    } catch (error) {
      logger.error(`Error processing block ${blockNum} on ${network}:`, error);
    }
  });

  // Handle provider connection events
  provider.on("network", (newNetwork, oldNetwork) => {
    if (oldNetwork) {
      logger.info(`Network changed from ${oldNetwork.name} to ${newNetwork.name}`);
    }
  });
}

async function processContractDeployment(
  tx: ethers.TransactionResponse,
  network: string,
  nats: any,
  pg: Client,
  provider: ethers.WebSocketProvider
) {
  try {
    const receipt = await provider.getTransactionReceipt(tx.hash);
    if (!receipt || !receipt.contractAddress) {
      return;
    }

    // Check if the deployer wallet is being watched
    const isWatched = await pg.query(
      "SELECT id FROM wallets WHERE address = $1",
      [tx.from.toLowerCase()]
    );

    if (isWatched.rowCount && isWatched.rowCount > 0) {
      const walletId = isWatched.rows[0].id;
      
      // Get block timestamp
      const block = await provider.getBlock(receipt.blockNumber);
      const timestamp = new Date(block!.timestamp * 1000);

      const payload: DeploymentEvent = {
        ts: timestamp.toISOString(),
        wallet: tx.from,
        contract: receipt.contractAddress,
        network: network,
        txHash: tx.hash,
        gas: receipt.gasUsed.toString(),
      };

      // Store deployment in database
      await pg.query(
        `INSERT INTO deployments (ts, wallet_id, network, contract_address, tx_hash, gas_used)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [timestamp, walletId, network, receipt.contractAddress, tx.hash, receipt.gasUsed.toString()]
      );

      // Publish event to NATS
      nats.publish("deployment.created", JSON.stringify(payload));
      
      logger.info(`Contract deployment detected:`, {
        wallet: tx.from,
        contract: receipt.contractAddress,
        network: network,
        txHash: tx.hash
      });
    }
  } catch (error) {
    logger.error(`Error processing deployment for tx ${tx.hash}:`, error);
  }
}

function getProviderUrl(network: string): string | null {
  const alchemyKey = process.env.ALCHEMY_KEY;
  if (!alchemyKey) {
    logger.error("ALCHEMY_KEY not provided");
    return null;
  }

  const urls: Record<string, string> = {
    "eth_mainnet": `wss://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    "sepolia": `wss://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`,
    "polygon": `wss://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    "arbitrum": `wss://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  };

  return urls[network] || null;
}

if (require.main === module) {
  main().catch(console.error);
} 