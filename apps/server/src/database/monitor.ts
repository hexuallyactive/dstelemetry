import type { Db } from 'mongodb'
import type { MonitoredDevice } from '@dstelemetry/types'
import {
  STORAGE_WARNING_THRESHOLD,
  MEMORY_WARNING_THRESHOLD,
  CPU_WARNING_THRESHOLD,
  DATA_STALE_MS,
} from '@dstelemetry/types'

export async function getMonitorData(db: Db): Promise<MonitoredDevice[]> {
  const data = await db.collection('devices').aggregate(
    [
      // 1. Join group for tenant name
      {
        $lookup: {
          from: "groups",
          localField: "groupId",
          foreignField: "id",
          as: "groupDoc"
        }
      },
      { $unwind: { path: "$groupDoc", preserveNullAndEmptyArrays: true } },
    
      // 2. Get latest CPU per device (match by hostname + groupId)
      {
        $lookup: {
          from: "cpu",
          let: { host: "$hostname", group: "$groupId" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$tags.host", "$$host"] },
              { $eq: ["$tags.group", "$$group"] }
            ]}}},
            { $sort: { timestamp: -1 } },
            { $limit: 1 }
          ],
          as: "latestCpu"
        }
      },
    
      // 3. Get latest memory
      {
        $lookup: {
          from: "memory",
          let: { host: "$hostname", group: "$groupId" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$tags.host", "$$host"] },
              { $eq: ["$tags.group", "$$group"] }
            ]}}},
            { $sort: { timestamp: -1 } },
            { $limit: 1 }
          ],
          as: "latestMem"
        }
      },
    
      // 4. Get latest disk
      {
        $lookup: {
          from: "disk",
          let: { host: "$hostname", group: "$groupId" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$tags.host", "$$host"] },
              { $eq: ["$tags.group", "$$group"] }
            ]}}},
            { $sort: { timestamp: -1 } },
            { $limit: 1 }
          ],
          as: "latestDisk"
        }
      },
    
      // 5. Get system (uptime)
      {
        $lookup: {
          from: "system",
          let: { host: "$hostname", group: "$groupId" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$host", "$$host"] },
              { $eq: ["$group", "$$group"] }
            ]}}},
            { $sort: { updatedAt: -1 } },
            { $limit: 1 }
          ],
          as: "latestSystem"
        }
      },
    
      // 6. Get active alerts
      {
        $lookup: {
          from: "alerts",
          let: { host: "$hostname", group: "$groupId" },
          pipeline: [
            { $match: {
              $expr: { $and: [
                { $eq: ["$host", "$$host"] },
                { $eq: ["$group", "$$group"] }
              ]},
              resolvedAt: "ACTIVE"
            }},
            { $sort: { firstDetectedAt: -1 } }
          ],
          as: "deviceAlerts"
        }
      },
    
        // 7. Get device processes
      {
        $lookup: {
          from: "process",
          let: { host: "$hostname", group: "$groupId" },
          pipeline: [
            { $match: {
              $expr: { $and: [
                { $eq: ["$host", "$$host"] },
                { $eq: ["$group", "$$group"] }
              ]}
            }},
            { $sort: { updatedAt: -1 } }
          ],
          as: "deviceProcesses"
        }
      },

      // 8. Get latest logs
      {
        $lookup: {
          from: "logs",
          let: { host: "$hostname", group: "$groupId" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ["$tags.host", "$$host"] },
              { $eq: ["$tags.group", "$$group"] }
            ]}}},
            { $sort: { timestamp: -1 } },
            { $limit: 100 }
          ],
          as: "latestLogs"
        }
      },
    
      // 9. Project to MonitoredDevice shape
      {
        $project: {
          id: "$id",
          name: "$name",
          hostname: "$hostname",
          location: "$location",
          tenant: "$groupDoc.name",
          status: {
            $let: {
              vars: {
                lastSeenTs: {
                  $max: [
                    { $ifNull: [{ $arrayElemAt: ['$latestCpu.timestamp', 0] }, new Date(0)] },
                    { $ifNull: [{ $arrayElemAt: ['$latestMem.timestamp', 0] }, new Date(0)] },
                    { $ifNull: [{ $arrayElemAt: ['$latestDisk.timestamp', 0] }, new Date(0)] },
                  ],
                },
              },
              in: {
                $cond: {
                  if: {
                    $in: [
                      'deadman',
                      {
                        $ifNull: [
                          { $map: { input: '$deviceAlerts', as: 'a', in: '$$a.type' } },
                          [],
                        ],
                      },
                    ],
                  },
                  then: 'offline',
                  else: {
                    $cond: {
                      if: {
                        $gt: [{ $subtract: ['$$NOW', '$$lastSeenTs'] }, DATA_STALE_MS],
                      },
                      then: 'offline',
                      else: {
                        $cond: {
                          if: { $gt: [{ $size: { $ifNull: ['$deviceAlerts', []] } }, 0] },
                          then: 'warning',
                          else: 'online',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          uptime: { $ifNull: [{ $arrayElemAt: ["$latestSystem.uptime", 0] }, 0] },
          storage: { $ifNull: [{ $arrayElemAt: ["$latestDisk.fields.used_percent", 0] }, 0] },
          memory: { $ifNull: [{ $arrayElemAt: ["$latestMem.fields.used_percent", 0] }, 0] },
          cpu: {
            $let: {
              vars: {
                c: { $arrayElemAt: ["$latestCpu", 0] }
              },
              in: {
                $ifNull: [
                  { $add: [
                    { $ifNull: ["$$c.fields.usage_user", 0] },
                    { $ifNull: ["$$c.fields.usage_system", 0] }
                  ]},
                  0
                ]
              }
            }
          },
          lastSeen: {
            $dateToString: {
              date: {
                $max: [
                  { $ifNull: [{ $arrayElemAt: ["$latestCpu.timestamp", 0] }, new Date("1970-01-01")] },
                  { $ifNull: [{ $arrayElemAt: ["$latestMem.timestamp", 0] }, new Date("1970-01-01")] },
                  { $ifNull: [{ $arrayElemAt: ["$latestDisk.timestamp", 0] }, new Date("1970-01-01")] }
                ]
              },
              format: "%Y-%m-%dT%H:%M:%S.000Z"
            }
          },
          processes: {
            $map: {
              input: "$deviceProcesses",
              as: "p",
              in: {
                executable: "$$p.executable",
                uptime: "$$p.uptime",
                updatedAt: "$$p.updated_at"
              }
            }
          },
          alerts: {
            $map: {
              input: "$deviceAlerts",
              as: "a",
              in: {
                id: { $add: [{ $indexOfArray: ["$deviceAlerts", "$$a"] }, 1] },
                type: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$$a.type", "deadman"] }, then: "error" }
                    ],
                    default: "warning"
                  }
                },
                message: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$$a.type", "deadman"] }, then: "Device unreachable" },
                      { case: { $eq: ["$$a.type", "cpu"] }, then: `CPU usage above ${CPU_WARNING_THRESHOLD}%` },
                      { case: { $eq: ["$$a.type", "memory"] }, then: `Memory usage above ${MEMORY_WARNING_THRESHOLD}%` },
                      { case: { $eq: ["$$a.type", "disk"] }, then: `Storage usage above ${STORAGE_WARNING_THRESHOLD}%` }
                    ],
                    default: "Alert"
                  }
                },
                timestamp: { $dateToString: { date: "$$a.firstDetectedAt", format: "%Y-%m-%dT%H:%M:%S.000Z" } }
              }
            }
          },
          logs: {
            $map: {
              input: "$latestLogs",
              as: "l",
              in: {
                timestamp: "$$l.timestamp",
                level: "$$l.level",
                message: "$$l.fields.message"
              }
            }
          }
        }
      }
    ]
  ).toArray()

  return data as MonitoredDevice[]
}
