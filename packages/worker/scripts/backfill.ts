#!/usr/bin/env ts-node

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
    connectionString: process.env.DATABASE_URL || "postgres://postgres:secret@localhost:5432/contractwatch",
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

    // Get all transactions from the wallet
    const logs = await provider.getLogs({
      fromBlock: fromBlock,
      toBlock: toBlock,
      address: null, // All addresses
      topics: [], // All topics
    });

    let processedCount = 0;
    let deploymentCount = 0;

    for (const log of logs) {
      try {
        const receipt = await provider.getTransactionReceipt(log.transactionHash);
        
        if (receipt && receipt.contractAddress && receipt.from.toLowerCase() === options.wallet.toLowerCase()) {
          // This is a contract deployment from our watched wallet
          const block = await provider.getBlock(receipt.blockNumber);
          
          if (block) {
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
      } catch (error) {
        logger.error(`Error processing log ${log.transactionHash}:`, error);
      }
      
      processedCount++;
      if (processedCount % 100 === 0) {
        logger.info(`Processed ${processedCount}/${logs.length} logs`);
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