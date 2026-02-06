import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type {
  CreateApiKeyBody,
  CreateApiKeyResponse,
  UpdateApiKeyBody,
  ApiKeyParams,
  ApiKeyResponse,
  ListApiKeysResponse,
  CreateTenantBody,
  UpdateTenantBody,
  TenantParams,
  TenantResponse,
  ListTenantsResponse,
  CreatePlayerBody,
  UpdatePlayerBody,
  PlayerParams,
  PlayerResponse,
  ListPlayersResponse,
  Tenant,
  Player,
} from '@dstelemetry/types'
import type { ApiKeyRecord, ApiKeyMetadata, CreateApiKeyInput } from 'keypal'
//import { authenticateApiKey } from '../middleware/auth.js'
import { getDatabase } from '../database/index.js'
import { keyManager, storage } from '../keypal/index.js'
import { logger } from '../logger.js'

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: number }).code === 11000)
}

export async function apiRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Apply authentication middleware to all routes in this plugin
  //fastify.addHook('onRequest', authenticateApiKey)

  const db = await getDatabase('telemetry')
  const tenantsCollection = db.collection<Tenant>('tenants')
  const playersCollection = db.collection<Player>('players')

  async function tenantExists(tenantId: string): Promise<boolean> {
    const tenant = await tenantsCollection.findOne({ id: tenantId }, { projection: { id: 1 } })
    return Boolean(tenant)
  }

  // POST /api/tenants - Create a new tenant
  fastify.post<{
    Body: CreateTenantBody
    Reply: TenantResponse | { error: string }
  }>('/tenants', async (request, reply) => {
    try {
      const { name, description } = request.body
      const now = new Date()
      const tenant: Tenant = {
        id: randomUUID(),
        name,
        description,
        createdAt: now,
        updatedAt: now,
      }

      await tenantsCollection.insertOne(tenant)
      reply.code(201).send(tenant)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        reply.code(409).send({ error: 'Tenant name already exists' })
        return
      }
      logger.error({ error }, 'Error creating tenant')
      reply.code(500).send({ error: 'Failed to create tenant' })
    }
  })

  // GET /api/tenants - List all tenants
  fastify.get<{
    Reply: ListTenantsResponse | { error: string }
  }>('/tenants', async (_request, reply) => {
    try {
      const tenants = await tenantsCollection.find({}).toArray()
      reply.send({ tenants })
    } catch (error) {
      logger.error({ error }, 'Error listing tenants')
      reply.code(500).send({ error: 'Failed to list tenants' })
    }
  })

  // GET /api/tenants/:id - Get a tenant by ID
  fastify.get<{
    Params: TenantParams
    Reply: TenantResponse | { error: string }
  }>('/tenants/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const tenant = await tenantsCollection.findOne({ id })
      if (!tenant) {
        reply.code(404).send({ error: 'Tenant not found' })
        return
      }
      reply.send(tenant)
    } catch (error) {
      logger.error({ error }, 'Error fetching tenant')
      reply.code(500).send({ error: 'Failed to fetch tenant' })
    }
  })

  // PUT /api/tenants/:id - Update a tenant
  fastify.put<{
    Params: TenantParams
    Body: UpdateTenantBody
    Reply: TenantResponse | { error: string }
  }>('/tenants/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const { name, description } = request.body
      if (!name && !description) {
        reply.code(400).send({ error: 'No updates provided' })
        return
      }

      const update: Partial<Tenant> = {
        ...(name && { name }),
        ...(description && { description }),
        updatedAt: new Date(),
      }

      const result = await tenantsCollection.findOneAndUpdate(
        { id },
        { $set: update },
        { returnDocument: 'after' }
      )

      if (!result) {
        reply.code(404).send({ error: 'Tenant not found' })
        return
      }

      reply.send(result)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        reply.code(409).send({ error: 'Tenant name already exists' })
        return
      }
      logger.error({ error }, 'Error updating tenant')
      reply.code(500).send({ error: 'Failed to update tenant' })
    }
  })

  // DELETE /api/tenants/:id - Delete a tenant
  fastify.delete<{
    Params: TenantParams
  }>('/tenants/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const result = await tenantsCollection.deleteOne({ id })
      if (result.deletedCount === 0) {
        reply.code(404).send({ error: 'Tenant not found' })
        return
      }
      reply.code(204).send()
    } catch (error) {
      logger.error({ error }, 'Error deleting tenant')
      reply.code(500).send({ error: 'Failed to delete tenant' })
    }
  })

  // POST /api/players - Create a new player
  fastify.post<{
    Body: CreatePlayerBody
    Reply: PlayerResponse | { error: string }
  }>('/players', async (request, reply) => {
    try {
      const { name, hostname, tenantId, description, location } = request.body

      if (!(await tenantExists(tenantId))) {
        reply.code(400).send({ error: 'Tenant not found' })
        return
      }

      const now = new Date()
      const player: Player = {
        id: randomUUID(),
        name,
        hostname,
        tenantId,
        description,
        location,
        createdAt: now,
        updatedAt: now,
      }

      await playersCollection.insertOne(player)
      reply.code(201).send(player)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        reply.code(409).send({ error: 'Player hostname already exists' })
        return
      }
      logger.error({ error }, 'Error creating player')
      reply.code(500).send({ error: 'Failed to create player' })
    }
  })

  // GET /api/players - List all players
  fastify.get<{
    Reply: ListPlayersResponse | { error: string }
  }>('/players', async (_request, reply) => {
    try {
      const players = await playersCollection.find({}).toArray()
      reply.send({ players })
    } catch (error) {
      logger.error({ error }, 'Error listing players')
      reply.code(500).send({ error: 'Failed to list players' })
    }
  })

  // GET /api/players/:id - Get a player by ID
  fastify.get<{
    Params: PlayerParams
    Reply: PlayerResponse | { error: string }
  }>('/players/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const player = await playersCollection.findOne({ id })
      if (!player) {
        reply.code(404).send({ error: 'Player not found' })
        return
      }
      reply.send(player)
    } catch (error) {
      logger.error({ error }, 'Error fetching player')
      reply.code(500).send({ error: 'Failed to fetch player' })
    }
  })

  // PUT /api/players/:id - Update a player
  fastify.put<{
    Params: PlayerParams
    Body: UpdatePlayerBody
    Reply: PlayerResponse | { error: string }
  }>('/players/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const { name, hostname, tenantId, description, location } = request.body
      if (!name && !hostname && !tenantId && !description && !location) {
        reply.code(400).send({ error: 'No updates provided' })
        return
      }

      if (tenantId && !(await tenantExists(tenantId))) {
        reply.code(400).send({ error: 'Tenant not found' })
        return
      }

      const update: Partial<Player> = {
        ...(name && { name }),
        ...(hostname && { hostname }),
        ...(tenantId && { tenantId }),
        ...(description && { description }),
        ...(location && { location }),
        updatedAt: new Date(),
      }

      const result = await playersCollection.findOneAndUpdate(
        { id },
        { $set: update },
        { returnDocument: 'after' }
      )

      if (!result) {
        reply.code(404).send({ error: 'Player not found' })
        return
      }

      reply.send(result)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        reply.code(409).send({ error: 'Player hostname already exists' })
        return
      }
      logger.error({ error }, 'Error updating player')
      reply.code(500).send({ error: 'Failed to update player' })
    }
  })

  // DELETE /api/players/:id - Delete a player
  fastify.delete<{
    Params: PlayerParams
  }>('/players/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const result = await playersCollection.deleteOne({ id })
      if (result.deletedCount === 0) {
        reply.code(404).send({ error: 'Player not found' })
        return
      }
      reply.code(204).send()
    } catch (error) {
      logger.error({ error }, 'Error deleting player')
      reply.code(500).send({ error: 'Failed to delete player' })
    }
  })

  // POST /api/keys - Create a new API key
  fastify.post<{
    Body: CreateApiKeyBody
    Reply: CreateApiKeyResponse | { error: string }
  }>('/keys', async (request, reply) => {
    try {
      const { ownerId, scopes, tags, metadata, expiresAt } = request.body

      // Use the authenticated key's ownerId if not provided
      const apiKeyInfo = request.apiKey
      const finalOwnerId = ownerId || apiKeyInfo?.record?.metadata?.ownerId || 'default'

      const createOptions: Partial<ApiKeyMetadata> = {
        ownerId: finalOwnerId,
        ...(scopes && { scopes }),
        ...(tags && { tags }),
        ...(expiresAt && { expiresAt: typeof expiresAt === 'string' ? expiresAt : new Date(expiresAt).toISOString() }),
        ...(metadata && metadata),
      }

      const { key, record } = await keyManager.create(createOptions)

      const response: CreateApiKeyResponse = {
        key, // Only returned once - should be stored securely
        id: record.id,
        createdAt: record.metadata.createdAt ? new Date(record.metadata.createdAt) : undefined,
        expiresAt: record.metadata.expiresAt ? new Date(record.metadata.expiresAt) : null,
        metadata: record.metadata,
        tags: record.metadata.tags,
        scopes: record.metadata.scopes,
      }

      reply.code(201).send(response)
    } catch (error) {
      logger.error({ error }, 'Error creating API key')
      reply.code(500).send({ error: 'Failed to create API key' })
    }
  })

  // GET /api/keys - List all API keys for the authenticated owner
  fastify.get<{
    Reply: ListApiKeysResponse | { error: string }
  }>('/keys', async (request, reply) => {
    try {
      const apiKeyInfo = request.apiKey
      const ownerId = apiKeyInfo?.record?.metadata?.ownerId

      if (!ownerId) {
        reply.code(400).send({ error: 'Unable to determine owner ID' })
        return
      }

      // Use storage directly if keyManager doesn't expose findByOwner
      const records = (keyManager as any).findByOwner 
        ? await (keyManager as any).findByOwner(ownerId)
        : await storage.findByOwner(ownerId)

      // Don't return the full key hash, just metadata
      const keys: ApiKeyResponse[] = records.map((record: ApiKeyRecord) => {
        return {
          id: record.id,
          createdAt: record.metadata.createdAt ? new Date(record.metadata.createdAt) : undefined,
          expiresAt: record.metadata.expiresAt ? new Date(record.metadata.expiresAt) : null,
          metadata: record.metadata,
          tags: record.metadata.tags,
          scopes: record.metadata.scopes,
          lastUsedAt: record.metadata.lastUsedAt ? new Date(record.metadata.lastUsedAt) : null,
        }
      })

      reply.send({ keys })
    } catch (error) {
      logger.error({ error }, 'Error listing API keys')
      reply.code(500).send({ error: 'Failed to list API keys' })
    }
  })

  // GET /api/keys/:id - Get a specific API key by ID
  fastify.get<{
    Params: ApiKeyParams
    Reply: ApiKeyResponse | { error: string }
  }>('/keys/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const apiKeyInfo = request.apiKey
      const ownerId = apiKeyInfo?.record?.metadata?.ownerId

      const record = await keyManager.findById(id)

      if (!record) {
        reply.code(404).send({ error: 'API key not found' })
        return
      }

      // Verify the key belongs to the authenticated owner
      if (record.metadata?.ownerId !== ownerId) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }

      // Don't return the full key hash
      const response: ApiKeyResponse = {
        id: record.id,
        createdAt: record.metadata.createdAt ? new Date(record.metadata.createdAt) : undefined,
        expiresAt: record.metadata.expiresAt ? new Date(record.metadata.expiresAt) : null,
        metadata: record.metadata,
        tags: record.metadata.tags,
        scopes: record.metadata.scopes,
        lastUsedAt: record.metadata.lastUsedAt ? new Date(record.metadata.lastUsedAt) : null,
      }

      reply.send(response)
    } catch (error) {
      logger.error({ error }, 'Error fetching API key')
      reply.code(500).send({ error: 'Failed to fetch API key' })
    }
  })

  // PUT /api/keys/:id - Update API key metadata
  fastify.put<{
    Params: ApiKeyParams
    Body: UpdateApiKeyBody
    Reply: ApiKeyResponse | { error: string }
  }>('/keys/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const { metadata, tags, scopes } = request.body
      const apiKeyInfo = request.apiKey
      const ownerId = apiKeyInfo?.record?.metadata?.ownerId

      const record = await keyManager.findById(id)

      if (!record) {
        reply.code(404).send({ error: 'API key not found' })
        return
      }

      // Verify the key belongs to the authenticated owner
      if (record.metadata?.ownerId !== ownerId) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }

      // Update metadata if provided
      if (metadata) {
        if ((keyManager as any).updateMetadata) {
          await (keyManager as any).updateMetadata(id, metadata)
        } else {
          await storage.updateMetadata(id, metadata)
        }
      }

      // Note: keypal might not support updating tags/scopes directly
      // You may need to implement this in the storage layer if needed
      // For now, we'll just update metadata

      const updatedRecord = await keyManager.findById(id)
      if (!updatedRecord) {
        reply.code(404).send({ error: 'API key not found after update' })
        return
      }

      const response: ApiKeyResponse = {
        id: updatedRecord.id,
        createdAt: updatedRecord.metadata.createdAt ? new Date(updatedRecord.metadata.createdAt) : undefined,
        expiresAt: updatedRecord.metadata.expiresAt ? new Date(updatedRecord.metadata.expiresAt) : null,
        metadata: updatedRecord.metadata,
        tags: updatedRecord.metadata.tags,
        scopes: updatedRecord.metadata.scopes,
        lastUsedAt: updatedRecord.metadata.lastUsedAt ? new Date(updatedRecord.metadata.lastUsedAt) : null,
      }

      reply.send(response)
    } catch (error) {
      logger.error({ error }, 'Error updating API key')
      reply.code(500).send({ error: 'Failed to update API key' })
    }
  })

  // DELETE /api/keys/:id - Delete an API key
  fastify.delete<{
    Params: ApiKeyParams
  }>('/keys/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const apiKeyInfo = request.apiKey
      const ownerId = apiKeyInfo?.record?.metadata?.ownerId

      const record = await keyManager.findById(id)

      if (!record) {
        reply.code(404).send({ error: 'API key not found' })
        return
      }

      // Verify the key belongs to the authenticated owner
      if (record.metadata?.ownerId !== ownerId) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }

      // Use storage directly if keyManager doesn't expose delete
      if ((keyManager as any).delete) {
        await (keyManager as any).delete(id)
      } else {
        await storage.delete(id)
      }

      reply.code(204).send()
    } catch (error) {
      logger.error({ error }, 'Error deleting API key')
      reply.code(500).send({ error: 'Failed to delete API key' })
    }
  })
}
