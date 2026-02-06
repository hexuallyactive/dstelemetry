import { createKeys } from 'keypal'
import { MongoDBStorage } from './storage/index.js'
import { getMongoClient } from '../database/index.js'
import type { ApiKeyManager } from 'keypal'

const storage = new MongoDBStorage(await getMongoClient())

export const keyManager: ApiKeyManager = createKeys({
  prefix: 'sk_prod_',
  length: 32,
  algorithm: 'sha256',
  salt: 'oy lordy',
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  storage,
  cache: true,
  cacheTtl: 60 * 60 * 4, // 4 hours
  autoTrackUsage: true,
  auditLogs: true
})

// Export storage for direct access if keyManager doesn't expose all methods
export { storage }