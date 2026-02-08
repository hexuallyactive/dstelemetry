import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { authenticateApiKey } from '../middleware/auth.js'
import { MetricsPayloadSchema, type CpuReading, type MemoryReading, type MetricsPayload, type StorageReading, type UptimeReading, type LogEntry, CpuReadingSchema, MemoryReadingSchema, StorageReadingSchema, UptimeReadingSchema, LogEntrySchema } from '@dstelemetry/types'
import { getDatabase } from '../database/index.ts'
import { logger } from '../logger.ts'
import { z } from 'zod'

export async function telemetryRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {

  const db = await getDatabase('telemetry')
  const cpuCollection = db.collection<CpuReading>('cpu')
  const memCollection = db.collection<MemoryReading>('memory')
  const diskCollection = db.collection<StorageReading>('disk')
  const systemCollection = db.collection<UptimeReading>('system')
  const logCollection = db.collection<LogEntry>('log')
  // Apply authentication middleware to all routes in this plugin
  fastify.addHook('preHandler', authenticateApiKey)

  fastify.post('/', async (request, reply) => {

    const parseResult = MetricsPayloadSchema.safeParse(request.body)
    if (!parseResult.success) {
      logger.warn({error: z.prettifyError(parseResult.error)}, 'Invalid payload')
      reply.code(400).send({ error: 'Invalid payload' })
      return
    }
    const payload: MetricsPayload = parseResult.data
    //console.log(JSON.stringify(payload, null, 2))
    //console.log(JSON.stringify(request.apiKey, null, 2))
    for (const metric of payload.metrics) {

      if (metric.tags.host !== request.apiKey?.record?.metadata.ownerId) {
        reply.code(400).send({ error: 'Invalid host' })
        return
      }

      metric.tags = {
        ...metric.tags,
        ownerId: request.apiKey?.record?.metadata.ownerId as string,
      }

      switch (metric.name) {
        case 'cpu':
          /*
          console.log(JSON.stringify(metric, null, 2))
          const cpuReadingParseResult = CpuReadingSchema.safeParse({
            ...metric,
            tags,
          })
          if (!cpuReadingParseResult.success) {
            logger.warn({error: z.prettifyError(cpuReadingParseResult.error)}, 'Invalid CPU reading')
            reply.code(400).send({ error: 'Invalid CPU reading' })
            return
          }
          const cpuReading: CpuReading = cpuReadingParseResult.data
          */
          await cpuCollection.insertOne(metric as unknown as CpuReading)
          break;
        case 'mem':
          await memCollection.insertOne(metric as unknown as MemoryReading)
          break;
        case 'disk':
          await diskCollection.insertOne(metric as unknown as StorageReading)
          break;
        case 'system':
          await systemCollection.insertOne(metric as unknown as UptimeReading)
          break;
        case 'log':

          break;
        default:
          break;
      }
    }
    reply.code(201).send()
  })
}
