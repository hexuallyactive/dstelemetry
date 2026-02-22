import {config} from "./config.js";
import compress from '@fastify/compress';
import { logger } from "./logger.js";
import fastify, { type FastifyRequest } from "fastify";
import { registerRoutes } from "./routes/index.js";
import { initializeTelemetryCollections, initializeSystemCollections, getMongoClient, alerts } from "./database/index.js";
import { fileURLToPath } from "url";
import path from "path";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import cron from "node-cron";

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

  await app.register(rateLimit, {
    max: 150,
    timeWindow: '30s',
    addHeaders: {
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    keyGenerator: (request: FastifyRequest): string => {
      const apiKey = request.headers['x-api-key'] as string;
      if (apiKey) {
        return apiKey;
      }
      return request.ip as string;
    },
    global: true,
  });

  app.register(compress, {
    encodings: ['zstd', 'br', 'gzip', 'deflate'], // modern encodings first, then fallback to older ones
    requestEncodings: ['zstd', 'br', 'gzip', 'deflate'],
    threshold: 2048, // generally recommended to be 2048 bytes
    global: true,
  });

    // __dirname replacement for ESM + TypeScript
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Serve the static React build files
  app.register(fastifyStatic, {
    root: path.join(__dirname, "./public"),
    prefix: "/",              // optional
    decorateReply: false,     // avoid reply.sendFile conflicts
  });

  cron.schedule('* * * * *', async() => {
    console.log('Running alerts cron job');
    await alerts();
  });

  app.listen({ port: config.HTTP_PORT, host: '0.0.0.0' }, (err, address) => {
    logger.info(`Server is running on ${address}`);
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });
}

main().catch(console.error);