import {config} from "./config.js";
import { logger } from "./logger.js";
import fastify from "fastify";
import { registerRoutes } from "./routes/index.js";
import { initializeTelemetryCollections, initializeSystemCollections, getMongoClient } from "./database/index.js";
import { fileURLToPath } from "url";
import path from "path";
import fastifyStatic from "@fastify/static";


async function main() {
  const app = fastify();

  try {
    await getMongoClient();
    await initializeTelemetryCollections();
    await initializeSystemCollections();
  } catch (error) {
    logger.error({ error }, 'Failed to initialize MongoDB and collections');
    process.exit(1);
  }

  await registerRoutes(app);

    // __dirname replacement for ESM + TypeScript
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Serve the static React build files
  app.register(fastifyStatic, {
    root: path.join(__dirname, "./public"),
    prefix: "/",              // optional
    decorateReply: false,     // avoid reply.sendFile conflicts
  });

  // SPA fallback (must be last)
  //app.get("/*", async (_request, reply) => {
  //  return reply.sendFile("index.html");
  //});

  app.listen({ port: config.HTTP_PORT }, (err, address) => {
    logger.info(`Server is running on ${address}`);
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });
}

main().catch(console.error);