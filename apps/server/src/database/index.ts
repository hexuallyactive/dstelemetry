import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';
import { logger } from '../logger.ts';

let client: MongoClient | null = null;
let isConnecting = false;

export async function getMongoClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  if (isConnecting) {
    // Wait for the connection to be established
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (client) {
      return client;
    }
  }

  isConnecting = true;

  try {
    const uri = config.MONGO_URI;
    
    client = new MongoClient(uri);
    await client.connect();
    
    console.log('Connected to MongoDB');
    return client;
  } catch (error) {
    isConnecting = false;
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  } finally {
    isConnecting = false;
  }
}

export async function getDatabase(dbName?: string): Promise<Db> {
  const mongoClient = await getMongoClient();
  const databaseName = dbName;
  return mongoClient.db(databaseName);
}

export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    console.log('MongoDB connection closed');
  }
}

/** Time-series collections with their TTL in seconds */
const TIMESERIES_COLLECTIONS = {
  cpu: 60 * 60 * 24 * 3, // 3 days
  memory: 60 * 60 * 24 * 3, // 3 days
  disk: 60 * 60 * 24 * 3, // 3 days
  system: 60 * 60 * 24 * 1, // 1 day
  logs: 60 * 60 * 24 * 7, // 7 days
} as const;

export async function initializeTelemetryCollections(): Promise<void> {
  try {
    const db = await getDatabase('telemetry');

    for (const [collectionName, expireAfterSeconds] of Object.entries(TIMESERIES_COLLECTIONS)) {
      try {
        // Check if collection already exists
        const existingCollections = await db.listCollections({ name: collectionName }).toArray();
        
        if (existingCollections.length === 0) {
          await db.createCollection(collectionName, {
            timeseries: {
              timeField: 'timestamp',
              metaField: 'tags',
              granularity: 'seconds',
            },
            expireAfterSeconds,
          });
          logger.info(`Created time series collection: ${collectionName}`);
        } else {
          logger.debug(`Collection ${collectionName} already exists, skipping creation`);
        }
      } catch (error: any) {
        // If collection already exists, MongoDB may throw an error
        // Check if it's a namespace exists error (code 48) or similar
        if (error.code === 48 || error.codeName === 'NamespaceExists') {
          logger.debug(`Collection ${collectionName} already exists, skipping creation`);
        } else {
          logger.error({ error, collectionName }, `Failed to create collection: ${collectionName}`);
          throw error;
        }
      }
    }

    logger.info('Telemetry collections initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize telemetry collections');
    throw error;
  }
}

/**
 * Initialize system collections for tenants and players in the telemetry database.
 * Creates collections with appropriate indexes.
 * This function is idempotent and safe to call multiple times.
 */
export async function initializeSystemCollections(): Promise<void> {
  try {
    const db = await getDatabase('telemetry');

    // Initialize alerts collection
    try {
      const existingAlerts = await db.listCollections({ name: 'alerts' }).toArray();
      if (existingAlerts.length === 0) {
        await db.createCollection('alerts');
        await db.collection('alerts').createIndex(
          { 
            host: 1, 
            type: 1, 
            resolvedAt: 1 
          },
          { 
            unique: true, 
            partialFilterExpression: { 
              resolvedAt: null
            }
          });
        logger.info('Created alerts collection with indexes');
      } else {
        logger.debug('Alerts collection already exists, skipping creation');
      }
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('Alerts collection already exists, skipping creation');
      } else {
        logger.error({ error }, 'Failed to create alerts collection');
        throw error;
      }
    }
    
    // Initialize tenants collection
    try {
      const existingTenants = await db.listCollections({ name: 'tenants' }).toArray();
      if (existingTenants.length === 0) {
        await db.createCollection('tenants');
        await db.collection('tenants').createIndex({ name: 1 }, { unique: true });
        logger.info('Created tenants collection with indexes');
      } else {
        logger.debug('Tenants collection already exists, skipping creation');
      }
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('Tenants collection already exists, skipping creation');
      } else {
        logger.error({ error }, 'Failed to create tenants collection');
        throw error;
      }
    }

    // Initialize players collection
    try {
      const existingPlayers = await db.listCollections({ name: 'players' }).toArray();
      if (existingPlayers.length === 0) {
        await db.createCollection('players');
        await db.collection('players').createIndex({ tenantId: 1 });
        await db.collection('players').createIndex({ hostname: 1 }, { unique: true });
        logger.info('Created players collection with indexes');
      } else {
        logger.debug('Players collection already exists, skipping creation');
        // Ensure indexes exist even if collection already exists
        await db.collection('players').createIndex({ tenantId: 1 });
        await db.collection('players').createIndex({ hostname: 1 }, { unique: true });
      }
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('Players collection already exists, ensuring indexes');
        try {
          await db.collection('players').createIndex({ tenantId: 1 });
          await db.collection('players').createIndex({ hostname: 1 }, { unique: true });
        } catch (indexError: any) {
          // Index might already exist, which is fine
          if (indexError.code !== 85 && indexError.codeName !== 'IndexOptionsConflict') {
            logger.warn({ error: indexError }, 'Failed to create index, may already exist');
          }
        }
      } else {
        logger.error({ error }, 'Failed to create players collection');
        throw error;
      }
    }

    try {
      const existingApiKeys = await db.listCollections({ name: 'api_keys' }).toArray();
      if (existingApiKeys.length === 0) {
        await db.createCollection('api_keys');
        await db.collection('api_keys').createIndex({ keyHash: 1 }, { unique: true });
        logger.info('Created api_keys collection with indexes');
      } else {
        logger.debug('api_keys collection already exists, skipping creation');
      }
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('api_keys collection already exists, skipping creation');
      } else {
        logger.error({ error }, 'Failed to create api_keys collection');
        throw error;
      }
    }

    try {
      const existingAuditLogs = await db.listCollections({ name: 'audit_logs' }).toArray();
      if (existingAuditLogs.length === 0) {
        await db.createCollection('audit_logs');
        await db.collection('audit_logs').createIndex({ timestamp: 1 });
        logger.info('Created audit_logs collection with indexes');
      }
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('audit_logs collection already exists, skipping creation');
      } else {
        logger.error({ error }, 'Failed to create audit_logs collection');
        throw error;
      }
    }

    logger.info('System collections initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize system collections');
    throw error;
  }
}
