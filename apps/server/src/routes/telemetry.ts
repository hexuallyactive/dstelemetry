import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { authenticateApiKey } from '../middleware/auth.js'
import { MetricsPayloadSchema, type CpuMetric, type MemMetric, type MetricsPayload, type DiskMetric, type SystemMetric, type LogMetric } from '@dstelemetry/types'
import { getDatabase } from '../database/index.ts'
import { logger } from '../logger.ts'
import { z } from 'zod'

export async function telemetryRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {

  const db = await getDatabase('telemetry')
  const cpuCollection = db.collection<CpuMetric>('cpu')
  const memCollection = db.collection<MemMetric>('memory')
  const diskCollection = db.collection<DiskMetric>('disk')
  const systemCollection = db.collection<SystemMetric>('system')
  const logCollection = db.collection<LogMetric>('log')
  // Apply authentication middleware to all routes in this plugin
  fastify.addHook('preHandler', authenticateApiKey)

  fastify.post('/', async (request, reply) => {
    //console.log(JSON.stringify(request.body, null, 2))
    //console.log(JSON.stringify(request.apiKey, null, 2))
    const parseResult = MetricsPayloadSchema.safeParse(request.body)
    if (!parseResult.success) {
      logger.warn({error: z.prettifyError(parseResult.error)}, 'Invalid payload')
      reply.code(400).send({ error: 'Invalid payload' })
      return
    }
    const payload: MetricsPayload = parseResult.data
    for (const metric of payload.metrics) {

      if (metric.tags.host !== request.apiKey?.record?.metadata.name) {
        reply.code(400).send({ error: 'Invalid host' })
        return
      }

      metric.tags = {
        ...metric.tags,
        group: request.apiKey?.record?.metadata.ownerId as string,
      }

      switch (metric.name) {
        case 'cpu':
          await cpuCollection.insertOne(metric)
          break;
        case 'mem':
          await memCollection.insertOne(metric)
          break;
        case 'disk':
          await diskCollection.insertOne(metric)
          break;
        case 'system':
          await systemCollection.insertOne(metric)
          break;
        case 'log':
          await logCollection.insertOne(metric)
          break;
      }
    }
    reply.code(201).send()
  })
}
