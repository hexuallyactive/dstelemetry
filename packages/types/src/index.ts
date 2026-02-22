import { z } from "zod";

// Consts
export const STORAGE_WARNING_THRESHOLD = 90 //90
export const MEMORY_WARNING_THRESHOLD = 85 //85
export const CPU_WARNING_THRESHOLD = 90 //90
/** Max age of last telemetry before device is considered offline (ms). Aligns with deadman alert threshold. */
export const DATA_STALE_MS = 5 * 60 * 1000

// Group
export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Group = z.infer<typeof GroupSchema>;

// Device
export const DeviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).trim(),
  hostname: z.string().min(1).trim(),
  groupId: z.string(),
  description: z.string(),
  location: z.string(),
  apiKeyId: z.string(),
  apiKey: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Device = z.infer<typeof DeviceSchema>;

// Group CRUD
export const CreateGroupBody = z.object({
  name: z.string().min(1).trim(),
  description: z.string(),
});

export type CreateGroupBody = z.infer<typeof CreateGroupBody>;

export const UpdateGroupBody = z.object({
  name: z.string().min(1).trim().optional(),
  description: z.string().optional(),
});

export type UpdateGroupBody = z.infer<typeof UpdateGroupBody>;

export const GroupParams = z.object({
  id: z.string(),
});

export type GroupParams = z.infer<typeof GroupParams>;

export const GroupResponse = GroupSchema;
export type GroupResponse = z.infer<typeof GroupResponse>;

export const ListGroupsResponse = z.object({
  groups: z.array(GroupSchema),
});

export type ListGroupsResponse = z.infer<typeof ListGroupsResponse>;

// Device CRUD
export const CreateDeviceBody = z.object({
  name: z.string().min(1).trim(),
  hostname: z.string().min(1).trim(),
  groupId: z.string(),
  description: z.string(),
  location: z.string(),
});

export type CreateDeviceBody = z.infer<typeof CreateDeviceBody>;

export const UpdateDeviceBody = z.object({
  name: z.string().min(1).trim().optional(),
  hostname: z.string().min(1).trim().optional(),
  groupId: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

export type UpdateDeviceBody = z.infer<typeof UpdateDeviceBody>;

export const DeviceParams = z.object({
  id: z.string(),
});

export type DeviceParams = z.infer<typeof DeviceParams>;

export const DeviceResponse = DeviceSchema;
export type DeviceResponse = z.infer<typeof DeviceResponse>;

export const ListDevicesResponse = z.object({
  devices: z.array(DeviceSchema),
});

export type ListDevicesResponse = z.infer<typeof ListDevicesResponse>;

// Telemetry
const TagsSchema = z.record(z.string(), z.string());

const TimestampSchema = z.preprocess(
  (value) =>
    typeof value === "number" ? new Date(value * 1000) : value,
  z.date().refine((d) => !isNaN(d.getTime()), {
    message: "Invalid timestamp",
  })
);

const CpuMetricSchema = z.object({
  name: z.literal('cpu'),
  timestamp: TimestampSchema,
  tags: TagsSchema,
  fields: z.object({
    usage_system: z.number(),
    usage_user: z.number(),
    usage_idle: z.number(),
  }),
});

const MemMetricSchema = z.object({
  name: z.literal('mem'),
  timestamp: TimestampSchema,
  tags: TagsSchema,
  fields: z.object({
    used_percent: z.number(),
  }),
});

const DiskMetricSchema = z.object({
  name: z.literal('disk'),
  timestamp: TimestampSchema,
  tags: TagsSchema,
  fields: z.object({
    used_percent: z.number(),
  }),
});

const SystemMetricSchema = z.object({
  name: z.literal('system'),
  timestamp: TimestampSchema,
  tags: TagsSchema,
  fields: z.object({
    uptime: z.number()
  }),
});

const ProcessMetricSchema = z.object({
  name: z.literal('procstat'),
  timestamp: TimestampSchema,
  tags: TagsSchema,
  fields: z.object({
    created_at: z.number(),
  }),
});

const LogMetricSchema = z.object({
  name: z.literal('log'),
  timestamp: TimestampSchema,
  tags: TagsSchema,
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  fields: z.object({
    message: z.string(),
  }),
});

export const MetricSchema = z.discriminatedUnion('name', [
  CpuMetricSchema,
  MemMetricSchema,
  DiskMetricSchema,
  SystemMetricSchema,
  ProcessMetricSchema,
  LogMetricSchema,
]);

export type Metric = z.infer<typeof MetricSchema>;

// Extract individual metric types from the discriminated union
export type CpuMetric = Extract<Metric, { name: 'cpu' }>;
export type MemMetric = Extract<Metric, { name: 'mem' }>;
export type DiskMetric = Extract<Metric, { name: 'disk' }>;
export type SystemMetric = Extract<Metric, { name: 'system' }>;
export type ProcessMetric = Extract<Metric, { name: 'procstat' }>;
export type LogMetric = Extract<Metric, { name: 'log' }>;

export const MetricsPayloadSchema = z.object({
  metrics: z.array(MetricSchema),
});

export const ProcessSchema = z.object({
  group: z.string(),
  host: z.string(),
  executable: z.string(),
  uptime: z.number(),
  updatedAt: z.date(),
});
export type Process = z.infer<typeof ProcessSchema>;

export const SystemSchema = z.object({
  group: z.string(),
  host: z.string(),
  uptime: z.number(),
  platform: z.string(),
  platform_version: z.string(),
  updatedAt: z.date(),
});
export type System = z.infer<typeof SystemSchema>;

export type MetricsPayload = z.infer<typeof MetricsPayloadSchema>;

export const AlertSchema = z.object({
  id: z.number(),
  type: z.enum(["info", "warning", "error"]),
  message: z.string(),
  timestamp: z.string(),
});
export type Alert = z.infer<typeof AlertSchema>;

export const LogSchema = z.object({
  timestamp: z.date(),
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  message: z.string(),
});
export type Log = z.infer<typeof LogSchema>;

export const MonitoredDeviceSchema = z.object({
  id: z.string(),
  hostname: z.string(),
  name: z.string(),
  location: z.string(),
  tenant: z.string(),
  status: z.enum(["online", "warning", "offline"]),
  uptime: z.number(),
  storage: z.number(),
  memory: z.number(),
  cpu: z.number(),
  lastSeen: z.string(),
  alerts: z.array(AlertSchema),
  processes: z.array(ProcessSchema),
  logs: z.array(LogSchema),
});

export type MonitoredDevice = z.infer<typeof MonitoredDeviceSchema>;