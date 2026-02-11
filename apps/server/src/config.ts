import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import console from 'node:console';
import process from 'node:process';
import { z } from 'zod';

/*
Environment variables schema
 but can be overridden via .env file or environment variables
*/
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production']).default('production'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'fatal', 'trace']).default('info'),
    LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
    MONGO_URI: z.string(),
    MONGO_USER: z.string(),
    MONGO_PASSWORD: z.string(),
    MONGO_DB_NAME: z.string().default('telemetry'),
    API_RATE_LIMIT: z.coerce.number().default(150),
    HTTP_PORT: z.coerce.number().default(4000),
  })
  .transform((config) => {
    // construct the full mongo URI with username and password
    const { MONGO_URI, MONGO_USER, MONGO_PASSWORD, ...rest } = config;
    const url = new URL(MONGO_URI);
    url.username = encodeURIComponent(MONGO_USER);
    url.password = encodeURIComponent(MONGO_PASSWORD);
    return {
      ...rest,
      MONGO_URI: url.toString(),
    };
  });

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  // don't use logger here as it is not initialized yet (circular dependency)
  console.error('Invalid environment variables:', z.prettifyError(parseResult.error));
  process.exit(1);
}

const config = parseResult.data;

// hydrate process.env with coerced values
// we need to do this manually because some libraries rely on process.env directly
for (const [key, val] of Object.entries(config)) {
  process.env[key] = String(val);
}

export { config };
