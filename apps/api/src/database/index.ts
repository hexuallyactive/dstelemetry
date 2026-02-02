import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';

let client: MongoClient | null = null;
let isConnecting = false;

/**
 * Get or create a MongoDB client instance.
 * Uses a singleton pattern to ensure only one connection is created.
 */
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

/**
 * Get a database instance from the MongoDB client.
 * @param dbName - The name of the database. Defaults to the value from MONGODB_DB_NAME env var or 'dstelemetry'
 */
export async function getDatabase(dbName?: string): Promise<Db> {
  const mongoClient = await getMongoClient();
  const databaseName = dbName;
  return mongoClient.db(databaseName);
}

/**
 * Close the MongoDB connection.
 * Useful for cleanup in tests or graceful shutdown.
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    console.log('MongoDB connection closed');
  }
}
