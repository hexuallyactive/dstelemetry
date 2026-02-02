import type { FastifyInstance } from 'fastify'
import { apiRoutes } from './api.js'
import { telemetryRoutes } from './telemetry.js'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(apiRoutes, { prefix: '/api' })
  await app.register(telemetryRoutes, { prefix: '/telemetry' })
}
