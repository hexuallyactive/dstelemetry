import { z } from "zod";

// Tenant
export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Tenant = z.infer<typeof TenantSchema>;

// Player
export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).trim(),
  hostname: z.string().min(1).trim(),
  tenantId: z.string(),
  description: z.string(),
  location: z.string(),
  apiKeyId: z.string(),
  apiKey: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Player = z.infer<typeof PlayerSchema>;

// Tenant CRUD
export const CreateTenantBody = z.object({
  name: z.string().min(1).trim(),
  description: z.string(),
});

export type CreateTenantBody = z.infer<typeof CreateTenantBody>;

export const UpdateTenantBody = z.object({
  name: z.string().min(1).trim().optional(),
  description: z.string().optional(),
});

export type UpdateTenantBody = z.infer<typeof UpdateTenantBody>;

export const TenantParams = z.object({
  id: z.string(),
});

export type TenantParams = z.infer<typeof TenantParams>;

export const TenantResponse = TenantSchema;
export type TenantResponse = z.infer<typeof TenantResponse>;

export const ListTenantsResponse = z.object({
  tenants: z.array(TenantSchema),
});

export type ListTenantsResponse = z.infer<typeof ListTenantsResponse>;

// Player CRUD
export const CreatePlayerBody = z.object({
  name: z.string().min(1).trim(),
  hostname: z.string().min(1).trim(),
  tenantId: z.string(),
  description: z.string(),
  location: z.string(),
});

export type CreatePlayerBody = z.infer<typeof CreatePlayerBody>;

export const UpdatePlayerBody = z.object({
  name: z.string().min(1).trim().optional(),
  hostname: z.string().min(1).trim().optional(),
  tenantId: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

export type UpdatePlayerBody = z.infer<typeof UpdatePlayerBody>;

export const PlayerParams = z.object({
  id: z.string(),
});

export type PlayerParams = z.infer<typeof PlayerParams>;

export const PlayerResponse = PlayerSchema;
export type PlayerResponse = z.infer<typeof PlayerResponse>;

export const ListPlayersResponse = z.object({
  players: z.array(PlayerSchema),
});

export type ListPlayersResponse = z.infer<typeof ListPlayersResponse>;

// Telemetry
const BaseTelemetrySchema = z.object({
  timestamp: z.preprocess(
    (value) =>
      typeof value === "number" ? new Date(value * 1000) : value,
    z.date().refine((d) => !isNaN(d.getTime()), {
      message: "Invalid timestamp",
    })
  ),
  tags: z.record(z.string(), z.string()),
});

export const CpuReadingSchema = BaseTelemetrySchema.extend({
  fields: z.object({
    usage_system: z.number(),
    usage_user: z.number(),
    usage_idle: z.number()
  })
});

export type CpuReading = z.infer<typeof CpuReadingSchema>;

export const MemoryReadingSchema = BaseTelemetrySchema.extend({
  fields: z.object({
    used_percent: z.number()
  })
});

export type MemoryReading = z.infer<typeof MemoryReadingSchema>;

export const StorageReadingSchema = BaseTelemetrySchema.extend({
  fields: z.object({
    used_percent: z.number()
  })
});

export type StorageReading = z.infer<typeof StorageReadingSchema>;

export const UptimeReadingSchema = BaseTelemetrySchema.extend({
  fields: z.object({
    uptime_seconds: z.number()
  })
});

export type UptimeReading = z.infer<typeof UptimeReadingSchema>;

export const LogEntrySchema = BaseTelemetrySchema.extend({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  fields: z.object({
    message: z.string()
  })
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

const TagsSchema = z.record(z.string(), z.string());

const MetricSchema = z.object({
  name: z.enum(['cpu', 'mem', 'disk', 'system', 'log']),
  timestamp: z.preprocess(
    (value) =>
      typeof value === "number" ? new Date(value * 1000) : value,
    z.date().refine((d) => !isNaN(d.getTime()), {
      message: "Invalid timestamp",
    })
  ),
  tags: TagsSchema,
  fields: z.record(z.string(), z.number().or(z.string())),
});

export const MetricsPayloadSchema = z.object({
  metrics: z.array(MetricSchema),
});

export type MetricsPayload = z.infer<typeof MetricsPayloadSchema>;