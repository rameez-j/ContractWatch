import { inferAsyncReturnType } from "@trpc/server";
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { Client } from "pg";
import { NatsConnection } from "nats";

export function createContext({ req, res }: CreateFastifyContextOptions) {
  const db = (req.server as any).db as Client;
  const nats = (req.server as any).nats as NatsConnection;

  return {
    req,
    res,
    db,
    nats,
    user: null, // Will be populated by auth middleware
  };
}

export type Context = inferAsyncReturnType<typeof createContext>; 