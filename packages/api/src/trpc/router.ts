import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  // Add wallet for monitoring
  addWallet: t.procedure
    .input(z.object({
      address: z.string().min(42).max(42), // Ethereum address length
      name: z.string().optional(),
      userId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const addr = input.address.toLowerCase();
      
      try {
        // Insert wallet if not exists, update name if provided
        await ctx.db.query(
          `INSERT INTO wallets (id, user_id, address, name, created_at) 
           VALUES (uuid_generate_v4(), $1, $2, $3, NOW()) 
           ON CONFLICT (address) DO UPDATE SET name = $3`,
          [input.userId || null, addr, input.name || null]
        );

        // Publish wallet added event
        ctx.nats.publish("wallet.added", addr);

        return { 
          success: true, 
          message: "Wallet added successfully",
          address: addr 
        };
      } catch (error) {
        throw new Error(`Failed to add wallet: ${error}`);
      }
    }),

  // List deployments for a wallet
  listDeployments: t.procedure
    .input(z.object({
      wallet: z.string().min(42).max(42),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;
      
      try {
        const result = await ctx.db.query(
          `SELECT 
            d.id,
            d.ts,
            d.network,
            d.contract_address,
            d.tx_hash,
            d.gas_used,
            w.address as wallet_address
           FROM deployments d
           JOIN wallets w ON d.wallet_id = w.id
           WHERE w.address = $1
           ORDER BY d.ts DESC
           LIMIT $2 OFFSET $3`,
          [input.wallet.toLowerCase(), limit, offset]
        );

        return {
          deployments: result.rows,
          total: result.rowCount || 0,
        };
      } catch (error) {
        throw new Error(`Failed to fetch deployments: ${error}`);
      }
    }),

  // Get all watched wallets
  getWallets: t.procedure
    .input(z.object({
      userId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.query(
          `SELECT 
            id,
            address,
            name,
            created_at,
            (SELECT COUNT(*) FROM deployments WHERE wallet_id = wallets.id) as deployment_count
           FROM wallets 
           WHERE user_id = $1 OR $1 IS NULL
           ORDER BY created_at DESC`,
          [input.userId || null]
        );

        return {
          wallets: result.rows,
        };
      } catch (error) {
        throw new Error(`Failed to fetch wallets: ${error}`);
      }
    }),

  // Get detailed wallet information
  getWalletDetails: t.procedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Get wallet details
        const walletResult = await ctx.db.query(
          `SELECT id, address, name, created_at FROM wallets WHERE id = $1`,
          [input.id]
        );

        if (walletResult.rows.length === 0) {
          throw new Error("Wallet not found");
        }

        const wallet = walletResult.rows[0];

        // Get deployment statistics
        const deploymentResult = await ctx.db.query(
          `SELECT COUNT(*) as count, COALESCE(SUM(gas_used), 0) as total_gas 
           FROM deployments WHERE wallet_id = $1`,
          [input.id]
        );

        // Get recent deployments
        const recentDeployments = await ctx.db.query(
          `SELECT * FROM deployments WHERE wallet_id = $1 ORDER BY ts DESC LIMIT 10`,
          [input.id]
        );

        return {
          wallet,
          stats: {
            deployments: parseInt(deploymentResult.rows[0].count),
            totalGas: parseInt(deploymentResult.rows[0].total_gas)
          },
          recentDeployments: recentDeployments.rows
        };
      } catch (error) {
        throw new Error(`Failed to get wallet details: ${error}`);
      }
    }),

  // Remove wallet from monitoring
  removeWallet: t.procedure
    .input(z.object({
      address: z.string().min(42).max(42),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.query(
          "DELETE FROM wallets WHERE address = $1",
          [input.address.toLowerCase()]
        );

        if (result.rowCount === 0) {
          throw new Error("Wallet not found");
        }

        // Publish wallet removed event
        ctx.nats.publish("wallet.removed", input.address.toLowerCase());

        return { 
          success: true, 
          message: "Wallet removed successfully" 
        };
      } catch (error) {
        throw new Error(`Failed to remove wallet: ${error}`);
      }
    }),

  // Get deployment statistics
  getStats: t.procedure
    .input(z.object({
      wallet: z.string().min(42).max(42).optional(),
      days: z.number().min(1).max(365).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const days = input.days ?? 30;
      
      try {
        let query = `
          SELECT 
            DATE_TRUNC('day', ts) as date,
            COUNT(*) as count,
            network
          FROM deployments d
          JOIN wallets w ON d.wallet_id = w.id
          WHERE d.ts >= NOW() - INTERVAL '${days} days'
        `;
        
        const params: any[] = [];
        
        if (input.wallet) {
          query += " AND w.address = $1";
          params.push(input.wallet.toLowerCase());
        }
        
        query += " GROUP BY DATE_TRUNC('day', ts), network ORDER BY date DESC";
        
        const result = await ctx.db.query(query, params);

        return {
          stats: result.rows,
        };
      } catch (error) {
        throw new Error(`Failed to fetch stats: ${error}`);
      }
    }),
});

export type AppRouter = typeof appRouter; 