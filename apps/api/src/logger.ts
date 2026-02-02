import pino, { type TransportMultiOptions, type TransportTargetOptions } from 'pino';

import { config } from './config.js';
type PinoOpts = Parameters<typeof pino>[0] & {
  transport?: TransportMultiOptions & { targets: TransportTargetOptions[] };
};

const opts: PinoOpts = {
  name: 'dstelemetry',
  level: config.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
    ],
    remove: false,
    censor: (value: unknown, path: string[]) => {
      if (config.NODE_ENV === 'production') {
        return '[REDACTED]';
      }
      return value;
    },
  },
};

// Only add transport configuration in development
if (config.LOG_FORMAT === 'pretty') {
  opts.transport = {
    targets: [
      {
        level: config.LOG_LEVEL || 'info',
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss.l',
          singleLine: false,
          ignore: process.env['NODE_ENV'] === 'production' ? 'pid' : 'pid,hostname',
        },
      },
    ],
  };
} else {
  // In production, add formatters for string log levels
  opts.formatters = {
    level: (label) => {
      return { level: label };
    },
    bindings: (bindings) => {
      return {
        //pid: bindings.pid, // we don't care about the pid in production
        hostname: process.env['NODE_ENV'] === 'production' ? undefined : bindings['hostname'],
      };
    },
  };
}

const logger = pino(opts);

const httpLogger = logger.child({ name: 'http' });
const authLogger = logger.child({ name: 'auth' });
const apiLogger = logger.child({ name: 'api' });
const tenantLogger = logger.child({ name: 'tenant' });

export { apiLogger, authLogger, httpLogger, logger, tenantLogger };
