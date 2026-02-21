import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';
import { logger } from '../logger.ts';
import { CPU_WARNING_THRESHOLD, MEMORY_WARNING_THRESHOLD, STORAGE_WARNING_THRESHOLD } from '@dstelemetry/types';

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
  cpu: 60 * 60 * 24 * 7, // 7 days
  memory: 60 * 60 * 24 * 7, // 7 days
  disk: 60 * 60 * 24 * 7, // 7 days
  logs: 60 * 60 * 24 * 7, // 7 days
} as const;

export async function initializeTelemetryCollections(): Promise<void> {
  try {
    const db = await getDatabase(config.MONGO_DB_NAME);

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
    const db = await getDatabase(config.MONGO_DB_NAME);

    // Initialize alerts collection
    try {
      const existingAlerts = await db.listCollections({ name: 'alerts' }).toArray();
      if (existingAlerts.length === 0) {
        await db.createCollection('alerts');
        await db.collection('alerts').createIndex(
          { 
            group: 1,
            host: 1, 
            type: 1, 
            resolvedAt: 1 
          },
          { 
            unique: true
          });
        await db.collection('alerts').createIndex(
          { resolvedAt: 1 },
          { expireAfterSeconds: 60 * 60 * 24 * 7 } // 30 days
        )
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

    // Initialize process collection
    try {
      const existingProcess = await db.listCollections({ name: 'process' }).toArray();
      if (existingProcess.length === 0) {
        await db.createCollection('process');
        await db.collection('process').createIndex(
          { 
            group: 1,
            host: 1, 
            executable: 1
          },
          { 
            unique: true
          });
        await db.collection('process').createIndex(
          { updatedAt: 1 },
          { expireAfterSeconds: 60 * 5 } // 5 minutes
        )
        logger.info('Created process collection with indexes');
      } else {
        logger.debug('Process collection already exists, skipping creation');
      }
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('Process collection already exists, skipping creation');
      } else {
        logger.error({ error }, 'Failed to create process collection');
        throw error;
      }
    }

    // Initialize system collection
    try {
      const existingSystem = await db.listCollections({ name: 'system' }).toArray();
      if (existingSystem.length === 0) {
        await db.createCollection('system');
        await db.collection('system').createIndex(
          { 
            group: 1,
            host: 1
          },
          { 
            unique: true
          });
        await db.collection('system').createIndex(
          { updatedAt: 1 },
          { expireAfterSeconds: 60 * 5 } // 5 minutes
        )
        logger.info('Created system collection with indexes');
      } else {
        logger.debug('System collection already exists, skipping creation');
      }
    } catch (error: any) {
      if (error.code === 48 || error.codeName === 'NamespaceExists') {
        logger.debug('System collection already exists, skipping creation');
      } else {
        logger.error({ error }, 'Failed to create system collection');
        throw error;
      }
    }

    logger.info('System collections initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize system collections');
    throw error;
  }
  
}

export async function alerts(): Promise<void> {
  const db = await getDatabase(config.MONGO_DB_NAME);
  try {

    // Find all hosts that have been seen in the last minute
    const alive = await db.collection('cpu').aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(Date.now() - 60 * 1000) } // 1 minute
        }
      },
      {
        $group: {
          _id: {
            host: "$tags.host",
            group: "$tags.group"
          }
        }
      }
    ]).toArray()

    // Resolve any deadman alerts for hosts that have been seen in the last minute
    if (alive.length > 0) {
      await db.collection('alerts').updateMany(
        {
          type: "deadman",
          resolvedAt: "ACTIVE",
          $or: alive.map(a => ({
            host: a._id.host,
            group: a._id.group
          }))
        },
        {
          $set: {
            resolvedAt: new Date()
          }
        }
      )
      //logger.info(`Resolved ${alive.length} deadman alerts`);
    } else {
      logger.info('No deadman alerts to resolve');
    }
    
    // Resolve any cpu alerts
    const cpuAlerts = await db.collection('cpu').aggregate(
      [
        {
          $match: {
            timestamp: { $gte: new Date(Date.now() - 6 * 60 * 1000) },
            "fields.usage_idle": { $gt: CPU_WARNING_THRESHOLD } // below threshold
          }
        },
        {
          $group: {
            _id: {
              group: "$tags.group",
              host: "$tags.host"
            }
          }
        }
      ]
    ).toArray();

    if (cpuAlerts.length > 0) {
      await db.collection('alerts').updateMany(
        {
          type: "cpu",
          resolvedAt: "ACTIVE",
          $or: cpuAlerts.map(r => ({
            group: r._id.group,
            host: r._id.host, 
          }))
        },
        {
          $set: { resolvedAt: new Date() }
        }
      )
    }

    const healthyHosts = await db.collection('memory').aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(Date.now() - 6 * 60 * 1000) },
          "fields.used_percent": { $lt: MEMORY_WARNING_THRESHOLD } //  below threshold
        }
      },
      {
        $group: {
          _id: {
            host: "$tags.host",
            group: "$tags.group"
          }
        }
      }
    ]).toArray()

    if (healthyHosts.length > 0) {
      await db.collection('alerts').updateMany(
        {
          type: "memory",
          resolvedAt: "ACTIVE",
          $or: healthyHosts.map(h => ({
            group: h._id.group,
            host: h._id.host, 
          }))
        },
        {
          $set: { resolvedAt: new Date() }
        }
      )
    }

    const diskAlerts = await db.collection('disk').aggregate(
      [
        {
          $match: {
            timestamp: { $gte: new Date(Date.now() - 6 * 60 * 1000) },
            "fields.used_percent": { $type: "number" }
          }
        },
        {
          $group: {
            _id: {
              group: "$tags.group",
              host: "$tags.host"
            },
            max_used: { $max: "$fields.used_percent" }
          }
        },
        {
          $match: {
            max_used: { $lt: STORAGE_WARNING_THRESHOLD }
          }
        }
      ]
    ).toArray()

    if (diskAlerts.length > 0) {
      await db.collection('alerts').updateMany(
        {
          type: "disk",
          resolvedAt: "ACTIVE",
          $or: diskAlerts.map(d => ({
            group: d._id.group,
            host: d._id.host, 
          }))
        },
        {
          $set: { resolvedAt: new Date() }
        }
      )
    }
    logger.info('Alerts updated successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to update alerts');
    throw error;
  }

  try {
    // deadman alerts
    await db.collection('cpu').aggregate(
      [
        {
          $group: {
            _id: {
              group: "$tags.group",
              host: "$tags.host"
            },
            lastSeen: {
              $max: "$timestamp"
            }
          }
        },
        {
          $match: {
            $expr: {
              $gt: [
                {
                  $subtract: ["$$NOW", "$lastSeen"]
                },
                5 * 60 * 1000 // 5 minutes
              ]
            }
          }
        },
        {
          $project: {
            _id: 0,
            group: "$_id.group",
            host: "$_id.host",
            type: "deadman",
            lastSeen: 1,
            firstDetectedAt: "$$NOW",
            resolvedAt: "ACTIVE"
          }
        },
        {
          $merge: {
            into: "alerts",
            on: ["group", "host", "type", "resolvedAt"],
            whenMatched: "keepExisting",
            whenNotMatched: "insert"
          }
        }
      ]
    ).toArray();

    // cpu alerts
    await db.collection('cpu').aggregate(
      [
        // Last 5 minutes
        {
          $match: {
            timestamp: {
              $gte: new Date(Date.now() - 5 * 60 * 1000)
            }
          }
        },
        // Compute cpu_used
        {
          $addFields: {
            cpu_used: {
              $add: [
                "$fields.usage_user",
                "$fields.usage_system"
              ]
            }
          }
        },
        // Keep only high-CPU samples
        {
          $match: {
            cpu_used: {
              $gt: CPU_WARNING_THRESHOLD
            }
          }
        },
        // Count high samples per host/group
        {
          $group: {
            _id: {
              group: "$tags.group",
              host: "$tags.host"
            },
            high_count: {
              $sum: 1
            },
            max_cpu: {
              $max: "$cpu_used"
            },
            firstDetectedAt: {
              $min: "$timestamp"
            },
            lastSeen: {
              $max: "$timestamp"
            }
          }
        },
        // Threshold: at least 6 samples in 5 minutes
        {
          $match: {
            high_count: {
              $gte: 6
            }
          }
        },
        // Shape for alerts
        {
          $project: {
            _id: 0,
            group: "$_id.group",
            host: "$_id.host",
            type: "cpu",
            firstDetectedAt: 1,
            lastSeen: 1,
            resolvedAt: "ACTIVE"
          }
        },
        {
          $merge: {
            into: "alerts",
            on: ["group", "host", "type", "resolvedAt"],
            whenMatched: "keepExisting",
            whenNotMatched: "insert"
          }
        }
      ]
    ).toArray();

    // memory alerts
    await db.collection('memory').aggregate(
      [
        // Restrict to recent samples
        {
          $match: {
            timestamp: {
              $gte: new Date(Date.now() - 5 * 60 * 1000)
            },
            "fields.used_percent": { $type: "number" }
          }
        },
      
        // Normalize + clamp memory usage
        {
          $addFields: {
            mem_used: {
              $min: [
                100,
                { $max: [0, "$fields.used_percent"] }
              ]
            }
          }
        },
      
        // Keep only high-memory samples
        {
          $match: {
            mem_used: { $gte: MEMORY_WARNING_THRESHOLD } // 85
          }
        },
      
        // aggregate per host/group
        {
          $group: {
            _id: {
              group: "$tags.group",
              host: "$tags.host"
            },
            high_count: { $sum: 1 },
            max_mem: { $max: "$mem_used" },
            firstDetectedAt: { $min: "$timestamp" },
            lastSeen: { $max: "$timestamp" }
          }
        },
      
        // Alert threshold (N samples in window)
        {
          $match: {
            high_count: { $gte: 2 }
          }
        },
      
        // Shape for alerts
        {
          $project: {
            _id: 0,
            group: "$_id.group",
            host: "$_id.host",
            type: "memory",
            firstDetectedAt: 1,
            lastSeen: 1,
            resolvedAt: "ACTIVE"
          }
        },
        {
          $merge: {
            into: "alerts",
            on: ["group", "host", "type", "resolvedAt"],
            whenMatched: "keepExisting",
            whenNotMatched: "insert"
          }
        }
      ]
      
    ).toArray();

    // disk alerts
    await db.collection('disk').aggregate(
      [
        // Restrict to recent samples
        {
          $match: {
            timestamp: {
              $gte: new Date(
                Date.now() - 15 * 60 * 1000
              )
            },
            "fields.used_percent": {
              $type: "number"
            }
          }
        },
        // Normalize + clamp disk usage
        {
          $addFields: {
            disk_used: {
              $min: [
                100,
                {
                  $max: [0, "$fields.used_percent"]
                }
              ]
            }
          }
        },
        // Keep only high samples
        {
          $match: {
            disk_used: {
              $gte: STORAGE_WARNING_THRESHOLD
            }
          }
        },
        // aggregate per host/group
        {
          $group: {
            _id: {
              group: "$tags.group",
              host: "$tags.host"
            },
            high_count: {
              $sum: 1
            },
            max_disk: {
              $max: "$disk_used"
            },
            firstDetectedAt: {
              $min: "$timestamp"
            },
            lastSeen: {
              $max: "$timestamp"
            }
          }
        },
        // Alert threshold (N samples in window)
        {
          $match: {
            high_count: {
              $gte: 2
            }
          }
        },
        // Shape for alerts
        {
          $project: {
            _id: 0,
            group: "$_id.group",
            host: "$_id.host",
            type: "disk",
            firstDetectedAt: 1,
            lastSeen: 1,
            resolvedAt: "ACTIVE"
          }
        },
        {
          $merge: {
            into: "alerts",
            on: ["group", "host", "type", "resolvedAt"],
            whenMatched: "keepExisting",
            whenNotMatched: "insert"
          }
        }
      ]
    ).toArray();
  } catch (error) {
    logger.error({ error }, 'Failed to update alerts');
    throw error;
  }
}