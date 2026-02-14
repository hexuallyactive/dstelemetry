import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { authenticateApiKey } from '../middleware/auth.js'
import { MetricsPayloadSchema, ProcessSchema, SystemSchema, type CpuMetric, type MemMetric, type MetricsPayload, type DiskMetric, type System, type SystemMetric, type LogMetric, type Process,type ProcessMetric } from '@dstelemetry/types'
import { getDatabase } from '../database/index.ts'
import { logger } from '../logger.ts'
import { exactOptional, z } from 'zod'
import { uptimeSecondsFromNsBigInt } from '../utils/index.ts'

export async function telemetryRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {

  const db = await getDatabase('telemetry')
  const cpuCollection = db.collection<CpuMetric>('cpu')
  const memCollection = db.collection<MemMetric>('memory')
  const diskCollection = db.collection<DiskMetric>('disk')
  const logCollection = db.collection<LogMetric>('log')
  const processCollection = db.collection<Process>('process')
  const systemCollection = db.collection<System>('system')

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
        case 'procstat': {
          const group = metric.tags.group;
          const host = metric.tags.host;
          const executable = metric.tags.process_name;
          if (group === undefined || host === undefined || executable === undefined) {
            logger.warn({ group, host, executable }, 'Missing required procstat fields');
            break;
          }
          const filter = {
            group: group,
            host: host,
            executable: executable
          };
          
          const update = {
            // Only set these if the document is being inserted
            $setOnInsert: {
              group: group,
              host: host,
              executable: executable,
            },
            // Always update uptime and updated_at
            $set: {
              uptime: uptimeSecondsFromNsBigInt(BigInt(metric.fields.created_at)),
              updatedAt: new Date()
            }
          };
          
          const options = {
            upsert: true
          };
          
          await processCollection.updateOne(filter, update, options);
          break;
        }
        case 'system': {
          const group = metric.tags.group;
          const host = metric.tags.host;
          if (group === undefined || host === undefined) {
            logger.warn({ group, host }, 'Missing required system fields');
            break;
          }
          const filter = {
            group: group,
            host: host
          };
          const update = {
            $setOnInsert: {
              group: group,
              host: host,
            },
            $set: {
              uptime: metric.fields.uptime,
              updatedAt: new Date()
            }
          };
          const options = {
            upsert: true
          };
          await systemCollection.updateOne(filter, update, options);
          break;
        }
        case 'log':
          await logCollection.insertOne(metric)
          break;
      }
    }
    reply.code(201).send()
  })
}
