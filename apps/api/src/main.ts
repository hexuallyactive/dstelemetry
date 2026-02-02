import {config} from "./config.js";
import { logger } from "./logger.js";
import fastify from "fastify";
import { registerRoutes } from "./routes/index.js";


async function main() {
  const app = fastify();

  // Register all routes
  await registerRoutes(app);

  app.listen({ port: 3000 }, (err, address) => {
    logger.info(`Server is running on ${address}`);
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });
}

main().catch(console.error);