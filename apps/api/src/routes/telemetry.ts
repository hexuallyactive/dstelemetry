import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { authenticateApiKey } from '../middleware/auth.js'

export async function telemetryRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Apply authentication middleware to all routes in this plugin
  fastify.addHook('onRequest', authenticateApiKey)

  fastify.post('/', async (request, reply) => {
    const body = request.body
    reply.code(201).send({ 
      message: 'Telemetry data received',
      data: body 
    })
  })
}
