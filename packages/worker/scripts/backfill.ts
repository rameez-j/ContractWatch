#!/usr/bin/env ts-node

import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config({ path: "../../.env" });

import { ethers } from "ethers";
import { Client } from "pg";
import { Command } from "commander";
import pino from "pino";

const logger = pino({ name: "backfill-script" });

interface BackfillOptions {
  wallet: string;
  network: string;
  blocks: number;
  fromBlock?: number;
}

async function backfillDeployments(options: BackfillOptions) {
  const provider = new ethers.JsonRpcProvider(getProviderUrl(options.network));
  const pg = new Client({
    connectionString: process.env.DATABASE_URL || "postgres://postgres:secret@localhost:5433/contractwatch",
  });
  await pg.connect();

  logger.info(`Starting backfill for wallet ${options.wallet} on ${options.network}`);

  try {
    // Get the wallet ID from database
    const walletResult = await pg.query("SELECT id FROM wallets WHERE address = $1", [
      options.wallet.toLowerCase(),
    ]);

    if (walletResult.rowCount === 0) {
      logger.error(`Wallet ${options.wallet} not found in database`);
      return;
    }

    const walletId = walletResult.rows[0].id;
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = options.fromBlock || currentBlock - options.blocks;
    const toBlock = currentBlock;

    logger.info(`Scanning blocks ${fromBlock} to ${toBlock}`);

    // Scan each block for transactions from the wallet
    let processedCount = 0;
    let deploymentCount = 0;

    for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
      try {
        const block = await provider.getBlock(blockNum, true);
        if (!block || !block.transactions.length) {
          continue;
        }

        for (const txHash of block.transactions) {
          try {
            const tx = await provider.getTransaction(txHash);
            if (tx && tx.from.toLowerCase() === options.wallet.toLowerCase() && !tx.to) {
              // This is a contract deployment from our watched wallet
              const receipt = await provider.getTransactionReceipt(tx.hash);
              
              if (receipt && receipt.contractAddress) {
                const timestamp = new Date(block.timestamp * 1000);
                
                // Check if we already have this deployment
                const existingDeployment = await pg.query(
                  "SELECT id FROM deployments WHERE tx_hash = $1",
                  [receipt.hash]
                );

                if (existingDeployment.rowCount === 0) {
                  // Insert new deployment
                  await pg.query(
                    `INSERT INTO deployments (ts, wallet_id, network, contract_address, tx_hash, gas_used)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                      timestamp,
                      walletId,
                      options.network,
                      receipt.contractAddress,
                      receipt.hash,
                      receipt.gasUsed.toString(),
                    ]
                  );
                  
                  deploymentCount++;
                  logger.info(`Added deployment: ${receipt.contractAddress} (tx: ${receipt.hash})`);
                }
              }
            }
          } catch (txError) {
            logger.debug(`Error processing transaction ${txHash}:`, txError);
          }
        }
      } catch (blockError) {
        logger.error(`Error processing block ${blockNum}:`, blockError);
      }
      
      processedCount++;
      if (processedCount % 100 === 0) {
        logger.info(`Processed ${processedCount}/${toBlock - fromBlock + 1} blocks`);
      }
    }

    logger.info(`Backfill completed. Found ${deploymentCount} new deployments.`);
  } catch (error) {
    logger.error("Backfill failed:", error);
  } finally {
    await pg.end();
  }
}

function getProviderUrl(network: string): string {
  const alchemyKey = process.env.ALCHEMY_KEY;
  if (!alchemyKey) {
    throw new Error("ALCHEMY_KEY not provided");
  }

  const urls: Record<string, string> = {
    "eth_mainnet": `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    "sepolia": `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`,
    "polygon": `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    "arbitrum": `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  };

  const url = urls[network];
  if (!url) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return url;
}

// CLI Setup
const program = new Command();

program
  .name("backfill")
  .description("Backfill historical contract deployments")
  .option("--wallet <address>", "Wallet address to backfill")
  .option("--network <network>", "Network to scan (eth_mainnet, sepolia, polygon, arbitrum)")
  .option("--blocks <count>", "Number of blocks to scan", "5000")
  .option("--from-block <number>", "Starting block number (optional)")
  .action(async (options) => {
    if (!options.wallet || !options.network) {
      logger.error("--wallet and --network are required");
      process.exit(1);
    }

    await backfillDeployments({
      wallet: options.wallet,
      network: options.network,
      blocks: parseInt(options.blocks),
      fromBlock: options.fromBlock ? parseInt(options.fromBlock) : undefined,
    });
  });

program.parse(); 