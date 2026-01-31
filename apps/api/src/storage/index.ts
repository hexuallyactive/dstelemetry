import { MongoClient, Collection } from 'mongodb'
import type { Storage, ApiKeyRecord, ApiKeyMetadata } from 'keypal'

export class MongoDBStorage implements Storage {
  private collection: Collection<ApiKeyRecord>

  constructor(client: MongoClient) {
    this.collection = client.db('myapp').collection<ApiKeyRecord>('api_keys')
  }

  async save(record: ApiKeyRecord): Promise<void> {
    await this.collection.insertOne(record)
  }

  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    return await this.collection.findOne({ keyHash })
  }

  async findById(id: string): Promise<ApiKeyRecord | null> {
    return await this.collection.findOne({ id })
  }

  async findByOwner(ownerId: string): Promise<ApiKeyRecord[]> {
    return await this.collection
      .find({ 'metadata.ownerId': ownerId })
      .toArray()
  }

  async findByTags(tags: string[]): Promise<ApiKeyRecord[]> {
    return await this.collection.find({ tags }).toArray()
  }

  async findByTag(tag: string): Promise<ApiKeyRecord[]> {
    return await this.collection.find({ tags: tag }).toArray()
  }

  async updateMetadata(id: string, metadata: Partial<ApiKeyMetadata>): Promise<void> {
    const update = Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [`metadata.${key}`, value])
    )
    await this.collection.updateOne({ id }, { $set: update })
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id })
  }

  async deleteByOwner(ownerId: string): Promise<void> {
    await this.collection.deleteMany({ 'metadata.ownerId': ownerId })
  }
}