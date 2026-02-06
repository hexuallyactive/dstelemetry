import type { FastifyRequest, FastifyReply } from 'fastify'
import type { ApiKeyVerificationResult } from '@dstelemetry/types'
import { keyManager } from '../keypal/index.js'
import { logger } from '../logger.js'

// Extend FastifyRequest to include apiKey
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyVerificationResult
  }
}

export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Try to get API key from Authorization header (Bearer token)
  let apiKey: string | undefined
  
  const authHeader = request.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7)
  } else {
    // Fallback to X-API-Key header
    apiKey = request.headers['x-api-key'] as string | undefined
  }

  if (!apiKey) {
    reply.code(401).send({ error: 'Missing API key' })
    return
  }

  try {
    const result = await keyManager.verify(apiKey)
    
    if (!result || !result.valid) {
      reply.code(401).send({ error: 'Invalid API key' })
      return
    }

    // Attach key info to request for use in route handlers
    request.apiKey = result as ApiKeyVerificationResult
  } catch (error) {
    logger.error({ error }, 'Error verifying API key')
    reply.code(401).send({ error: 'Invalid API key' })
    return
  }
}