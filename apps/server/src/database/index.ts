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
    
    // Initialize groups collection
    try {
      const existingGroups = await db.listCollections({ name: 'groups' }).toArray();
      if (existingGroups.length === 0) {
        await db.createCollection('groups');
        logger.info('Created groups collection');
      } else {
        logger.debug('Groups collection already exists, skipping creation');
      }
      // Ensure indexes exist
      await db.collection('groups').createIndex({ id: 1 }, { unique: true });
      await db.collection('groups').createIndex({ name: 1 }, { unique: true });
      logger.debug('Groups indexes ensured');
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('Groups collection already exists, skipping creation');
      } else {
        logger.error({ error }, 'Failed to create groups collection');
        throw error;
      }
    }

    // Initialize devices collection
    try {
      const existingDevices = await db.listCollections({ name: 'devices' }).toArray();
      if (existingDevices.length === 0) {
        await db.createCollection('devices');
        logger.info('Created devices collection');
      } else {
        logger.debug('Devices collection already exists, skipping creation');
      }
      // Ensure indexes exist
      await db.collection('devices').createIndex({ id: 1 }, { unique: true });
      await db.collection('devices').createIndex({ groupId: 1 });
      await db.collection('devices').createIndex({ hostname: 1 }, { unique: true });
      await db.collection('devices').createIndex({ apiKeyId: 1 }, { unique: true });
      logger.debug('Devices indexes ensured');
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('Devices collection already exists, skipping creation');
      } else {
        logger.error({ error }, 'Failed to create devices collection');
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
