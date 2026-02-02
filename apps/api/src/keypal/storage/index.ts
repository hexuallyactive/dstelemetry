import { MongoClient, Collection } from 'mongodb'
import type { Storage, ApiKeyRecord, ApiKeyMetadata } from 'keypal'
import type { AuditLog, AuditLogQuery, AuditLogStats } from 'keypal'

export class MongoDBStorage implements Storage {

  private keysCollection: Collection<ApiKeyRecord>
  private logsCollection: Collection<AuditLog>

  constructor(client: MongoClient) {
    this.keysCollection = client.db('telemetry').collection<ApiKeyRecord>('api_keys')
    this.logsCollection = client.db('telemetry').collection<AuditLog>('audit_logs')
  }

  async save(record: ApiKeyRecord): Promise<void> {
    await this.keysCollection.insertOne(record)
  }

  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    return await this.keysCollection.findOne({ keyHash: keyHash })
  }

  async findById(id: string): Promise<ApiKeyRecord | null> {
    return await this.keysCollection.findOne({ id })
  }

  async findByOwner(ownerId: string): Promise<ApiKeyRecord[]> {
    return await this.keysCollection
      .find({ 'metadata.ownerId': ownerId })
      .toArray()
  }

  async findByTags(tags: string[]): Promise<ApiKeyRecord[]> {
    return await this.keysCollection.find({ tags }).toArray()
  }

  async findByTag(tag: string): Promise<ApiKeyRecord[]> {
    return await this.keysCollection.find({ tags: tag }).toArray()
  }

  async updateMetadata(id: string, metadata: Partial<ApiKeyMetadata>): Promise<void> {
    const update = Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [`metadata.${key}`, value])
    )
    await this.keysCollection.updateOne({ id }, { $set: update })
  }

  async delete(id: string): Promise<void> {
    await this.keysCollection.deleteOne({ id })
  }

  async deleteByOwner(ownerId: string): Promise<void> {
    await this.keysCollection.deleteMany({ 'metadata.ownerId': ownerId })
  }

  async saveLog(log: AuditLog): Promise<void> {
    await this.logsCollection.insertOne(log)
  }

  async findLogs(query: AuditLogQuery): Promise<AuditLog[]> {
    return await this.logsCollection.find(query).toArray()
  }

  async countLogs(query: AuditLogQuery): Promise<number> {
    return await this.logsCollection.countDocuments(query)
  }

  //async findLogStats(query: AuditLogQuery): Promise<AuditLogStats> {
    //return await this.logsCollection.aggregate([{ $match: query }, { $group: { _id: null, count: { $sum: 1 } } }]).toArray()
  //}
}