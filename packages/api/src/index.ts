import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";
import { connect as connectNats } from "nats";
import { Client } from "pg";
import pino from "pino";

// Export the AppRouter type for client-side usage
export type { AppRouter } from "./trpc/router";

const logger = pino({ 
  name: "contractwatch-api",
  level: process.env.LOG_LEVEL || "info"
});

const fastify = Fastify({
  logger: logger,
  maxParamLength: 5000,
});

async function start() {
  try {
    // Register plugins
    await fastify.register(fastifyCors, {
      origin: process.env.CORS_ORIGIN || "http://localhost:3001",
      credentials: true,
    });

    await fastify.register(fastifyJwt, {
      secret: process.env.JWT_SECRET || "your-secret-key",
    });

    await fastify.register(fastifyWebsocket);

    // Initialize database connection
    const db = new Client({
      connectionString: process.env.DATABASE_URL || "postgres://postgres:secret@localhost:5432/contractwatch",
    });
    await db.connect();

    // Initialize NATS connection
    const nats = await connectNats({
      servers: process.env.NATS_URL || "nats://localhost:4222",
    });

    // Store connections in fastify instance
    fastify.decorate("db", db);
    fastify.decorate("nats", nats);

    // Register tRPC
    await fastify.register(fastifyTRPCPlugin, {
      prefix: "/trpc",
      trpcOptions: {
        router: appRouter,
        createContext: createContext,
      },
    });

    // WebSocket endpoint for real-time updates
    fastify.register(async function (fastify) {
      fastify.get("/live", { websocket: true }, (connection, req) => {
        logger.info("WebSocket connection established");
        
        // Subscribe to deployment events
        const subscription = nats.subscribe("deployment.created");
        
        (async () => {
          for await (const msg of subscription) {
            try {
              const data = JSON.parse(msg.string());
              connection.socket.send(JSON.stringify(data));
            } catch (error) {
              logger.error("Error parsing NATS message:", error);
            }
          }
        })();

        connection.socket.on("close", () => {
          logger.info("WebSocket connection closed");
          subscription.unsubscribe();
        });
      });
    });

    // Health check endpoint
    fastify.get("/health", async (request, reply) => {
      return { status: "ok", timestamp: new Date().toISOString() };
    });

    // Start server
    const port = parseInt(process.env.PORT || "3000");
    await fastify.listen({ port, host: "0.0.0.0" });
    
    logger.info(`API server running on port ${port}`);

  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
} 