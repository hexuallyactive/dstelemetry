import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type {
  CreateApiKeyBody,
  CreateApiKeyResponse,
  UpdateApiKeyBody,
  ApiKeyParams,
  ApiKeyResponse,
  ListApiKeysResponse,
} from '@dstelemetry/types'
import type { ApiKeyRecord, ApiKeyMetadata, CreateApiKeyInput } from 'keypal'
//import { authenticateApiKey } from '../middleware/auth.js'
import { keyManager, storage } from '../keypal/index.js'
import { logger } from '../logger.js'

export async function apiRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Apply authentication middleware to all routes in this plugin
  //fastify.addHook('onRequest', authenticateApiKey)

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
