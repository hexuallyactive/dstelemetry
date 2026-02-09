import { nanoid } from 'nanoid'
import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type {
  CreateGroupBody,
  UpdateGroupBody,
  GroupParams,
  GroupResponse,
  ListGroupsResponse,
  CreateDeviceBody,
  UpdateDeviceBody,
  DeviceParams,
  DeviceResponse,
  ListDevicesResponse,
  Group,
  Device,
} from '@dstelemetry/types'

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

  const db = await getDatabase('telemetry')
  const groupsCollection = db.collection<Group>('groups')
  const devicesCollection = db.collection<Device>('devices')

  async function groupExists(groupId: string): Promise<boolean> {
    const group = await groupsCollection.findOne({ id: groupId }, { projection: { id: 1 } })
    return Boolean(group)
  }

  // POST /api/groups - Create a new group
  fastify.post<{
    Body: CreateGroupBody
    Reply: GroupResponse | { error: string }
  }>('/groups', async (request, reply) => {
    try {
      const { name, description } = request.body
      const now = new Date()
      const group: Group = {
        id: nanoid(),
        name,
        description,
        createdAt: now,
        updatedAt: now,
      }

      await groupsCollection.insertOne(group)
      reply.code(201).send(group)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        reply.code(409).send({ error: 'Group name already exists' })
        return
      }
      logger.error({ error }, 'Error creating group')
      reply.code(500).send({ error: 'Failed to create group' })
    }
  })

  // GET /api/groups - List all groups
  fastify.get<{
    Reply: ListGroupsResponse | { error: string }
  }>('/groups', async (_request, reply) => {
    try {
      const groups = await groupsCollection.find({}).toArray()
      reply.send({ groups })
    } catch (error) {
      logger.error({ error }, 'Error listing groups')
      reply.code(500).send({ error: 'Failed to list groups' })
    }
  })

  // GET /api/groups/:id - Get a group by ID
  fastify.get<{
    Params: GroupParams
    Reply: GroupResponse | { error: string }
  }>('/groups/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const group = await groupsCollection.findOne({ id })
      if (!group) {
        reply.code(404).send({ error: 'Group not found' })
        return
      }
      reply.send(group)
    } catch (error) {
      logger.error({ error }, 'Error fetching group')
      reply.code(500).send({ error: 'Failed to fetch group' })
    }
  })

  // PUT /api/groups/:id - Update a group
  fastify.put<{
    Params: GroupParams
    Body: UpdateGroupBody
    Reply: GroupResponse | { error: string }
  }>('/groups/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const { name, description } = request.body
      if (!name && !description) {
        reply.code(400).send({ error: 'No updates provided' })
        return
      }

      const update: Partial<Group> = {
        ...(name && { name }),
        ...(description && { description }),
        updatedAt: new Date(),
      }

      const result = await groupsCollection.findOneAndUpdate(
        { id },
        { $set: update },
        { returnDocument: 'after' }
      )

      if (!result) {
        reply.code(404).send({ error: 'Group not found' })
        return
      }

      reply.send(result)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        reply.code(409).send({ error: 'Group name already exists' })
        return
      }
      logger.error({ error }, 'Error updating group')
      reply.code(500).send({ error: 'Failed to update group' })
    }
  })

  // DELETE /api/groups/:id - Delete a group
  fastify.delete<{
    Params: GroupParams
  }>('/groups/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const result = await groupsCollection.deleteOne({ id })
      if (result.deletedCount === 0) {
        reply.code(404).send({ error: 'Group not found' })
        return
      }

      // Delete all devices associated with this group and revoke their API keys
      const devices = await devicesCollection.find({ groupId: id }).toArray()
      for (const device of devices) {
        await keyManager.revoke(device.apiKeyId)
      }
      await devicesCollection.deleteMany({ groupId: id })

      reply.code(204).send()
    } catch (error) {
      logger.error({ error }, 'Error deleting group')
      reply.code(500).send({ error: 'Failed to delete group' })
    }
  })

  // POST /api/devices - Create a new device
  fastify.post<{
    Body: CreateDeviceBody
    Reply: DeviceResponse | { error: string }
  }>('/devices', async (request, reply) => {
    try {
      const { name, hostname, groupId, description, location } = request.body

      if (!(await groupExists(groupId))) {
        reply.code(400).send({ error: 'Group not found' })
        return
      }

      const now = new Date()
      const device: Device = {
        id: nanoid(),
        name,
        hostname,
        groupId,
        description,
        location,
        apiKey: '',
        apiKeyId: '',
        createdAt: now,
        updatedAt: now,
      }

      await devicesCollection.insertOne(device)

      const { key, record: apiKeyRecord } = await keyManager.create({
        name: `${hostname}`,
        description: `Telemetry API key for ${hostname}`,
        scopes: ['write'],
        tags: ['production'],
        ownerId: groupId,
      })

      if (!apiKeyRecord) {
        await devicesCollection.deleteOne({ id: device.id })
        reply.code(500).send({ error: 'Failed to create API key' })
        return
      }

      const updatedDevice = await devicesCollection.findOneAndUpdate(
        { id: device.id },
        { $set: { apiKey: key, apiKeyId: apiKeyRecord.id } },
        { returnDocument: 'after' }
      )

      reply.code(201).send(updatedDevice!)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        reply.code(409).send({ error: 'Device hostname already exists' })
        return
      }
      logger.error({ error }, 'Error creating device')
      reply.code(500).send({ error: 'Failed to create device' })
    }
  })

  // GET /api/devices - List all devices
  fastify.get<{
    Reply: ListDevicesResponse | { error: string }
  }>('/devices', async (_request, reply) => {
    try {
      const devices = await devicesCollection.find({}).toArray()
      reply.send({ devices })
    } catch (error) {
      logger.error({ error }, 'Error listing devices')
      reply.code(500).send({ error: 'Failed to list devices' })
    }
  })

  // GET /api/devices/:id - Get a device by ID
  fastify.get<{
    Params: DeviceParams
    Reply: DeviceResponse | { error: string }
  }>('/devices/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const device = await devicesCollection.findOne({ id })
      if (!device) {
        reply.code(404).send({ error: 'Device not found' })
        return
      }
      reply.send(device)
    } catch (error) {
      logger.error({ error }, 'Error fetching device')
      reply.code(500).send({ error: 'Failed to fetch device' })
    }
  })

  // PUT /api/devices/:id - Update a device
  fastify.put<{
    Params: DeviceParams
    Body: UpdateDeviceBody
    Reply: DeviceResponse | { error: string }
  }>('/devices/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const { name, hostname, groupId, description, location } = request.body
      if (!name && !hostname && !groupId && !description && !location) {
        reply.code(400).send({ error: 'No updates provided' })
        return
      }

      if (groupId && !(await groupExists(groupId))) {
        reply.code(400).send({ error: 'Group not found' })
        return
      }

      const update: Partial<Device> = {
        ...(name && { name }),
        ...(hostname && { hostname }),
        ...(groupId && { groupId }),
        ...(description && { description }),
        ...(location && { location }),
        updatedAt: new Date(),
      }

      const result = await devicesCollection.findOneAndUpdate(
        { id },
        { $set: update },
        { returnDocument: 'after' }
      )

      if (!result) {
        reply.code(404).send({ error: 'Device not found' })
        return
      }

      reply.send(result)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        reply.code(409).send({ error: 'Device hostname already exists' })
        return
      }
      logger.error({ error }, 'Error updating device')
      reply.code(500).send({ error: 'Failed to update device' })
    }
  })

  // DELETE /api/devices/:id - Delete a device
  fastify.delete<{
    Params: DeviceParams
  }>('/devices/:id', async (request, reply) => {
    try {
      const { id } = request.params
      const device = await devicesCollection.findOne({ id })
      if (!device) {
        reply.code(404).send({ error: 'Device not found' })
        return
      }
      await keyManager.revoke(device.apiKeyId)
      const result = await devicesCollection.deleteOne({ id })
      reply.code(204).send()
    } catch (error) {
      logger.error({ error }, 'Error deleting device')
      reply.code(500).send({ error: 'Failed to delete device' })
    }
  })

  // POST /api/devices/:id/rotate-key - Rotate a device's API key
  fastify.post<{
    Params: DeviceParams
    Reply: DeviceResponse | { error: string }
  }>('/devices/:id/rotate-key', async (request, reply) => {
    try {
      const { id } = request.params
      const device = await devicesCollection.findOne({ id })
      if (!device) {
        reply.code(404).send({ error: 'Device not found' })
        return
      }

      // Revoke the old API key
      if (device.apiKeyId) {
        await keyManager.revoke(device.apiKeyId)
      }

      // Create a new API key
      const { key, record: apiKeyRecord } = await keyManager.create({
        name: `${device.hostname}`,
        description: `Telemetry API key for ${device.hostname}`,
        scopes: ['write'],
        tags: ['production'],
        ownerId: device.groupId,
      })

      if (!apiKeyRecord) {
        reply.code(500).send({ error: 'Failed to create new API key' })
        return
      }

      const updatedDevice = await devicesCollection.findOneAndUpdate(
        { id },
        { $set: { apiKey: key, apiKeyId: apiKeyRecord.id, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )

      reply.send(updatedDevice!)
    } catch (error) {
      logger.error({ error }, 'Error rotating API key')
      reply.code(500).send({ error: 'Failed to rotate API key' })
    }
  })
}
