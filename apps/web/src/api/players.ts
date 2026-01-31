// Types
export interface Alert {
  id: number
  type: "info" | "warning" | "error"
  message: string
  timestamp: string
}

export interface Player {
  id: string
  name: string
  location: string
  tenant: string
  status: "online" | "warning" | "offline"
  uptime: number // uptime in seconds
  storage: number
  memory: number // memory usage percentage
  cpu: number
  lastSeen: string // UTC datetime in ISO 8601 format
  alerts: Alert[]
}

// Helper to generate a UTC datetime string relative to now
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function secondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

// Mock data
const players: Player[] = [
  {
    id: "PLAYER-001",
    name: "Lobby Display 1",
    location: "Main Building - Lobby",
    tenant: "Acme Corp",
    status: "online",
    uptime: 72000, // 20 hours
    storage: 45,
    memory: 58,
    cpu: 32,
    lastSeen: minutesAgo(2),
    alerts: [
    ],
  },
  {
    id: "PLAYER-002",
    name: "Conference Room A",
    location: "Building A - Floor 3",
    tenant: "Acme Corp",
    status: "online",
    uptime: 64925, // 18 hours
    storage: 62,
    memory: 41,
    cpu: 28,
    lastSeen: minutesAgo(1),
    alerts: [],
  },
  {
    id: "PLAYER-003",
    name: "Cafeteria Display",
    location: "Main Building - Cafeteria",
    tenant: "TechStart Inc",
    status: "warning",
    uptime: 7800, // 2 hours 10 minutes
    storage: 88,
    memory: 76,
    cpu: 72,
    lastSeen: minutesAgo(5),
    alerts: [
      { id: 1, type: "warning", message: "Storage usage above 85% threshold", timestamp: minutesAgo(10) },
      { id: 2, type: "warning", message: "CPU usage spike detected", timestamp: minutesAgo(25) },
    ],
  },
  {
    id: "PLAYER-004",
    name: "Reception Display",
    location: "Building B - Entrance",
    tenant: "RetailMax",
    status: "offline",
    uptime: 0,
    storage: 0,
    memory: 0,
    cpu: 0,
    lastSeen: hoursAgo(2),
    alerts: [
      { id: 1, type: "error", message: "Device unreachable - connection timeout", timestamp: hoursAgo(2) },
      { id: 2, type: "error", message: "Heartbeat signal lost", timestamp: hoursAgo(2) },
      { id: 3, type: "info", message: "Last successful ping recorded", timestamp: hoursAgo(2) },
    ],
  },
  {
    id: "PLAYER-005",
    name: "Elevator Display 1",
    location: "Main Building - Floor 1",
    tenant: "Acme Corp",
    status: "online",
    uptime: 43200, // 12 hours
    storage: 52,
    memory: 63,
    cpu: 38,
    lastSeen: minutesAgo(3),
    alerts: [],
  },
  {
    id: "PLAYER-006",
    name: "Parking Lot Sign",
    location: "Parking Structure - Level 1",
    tenant: "Acme Corp",
    status: "online",
    uptime: 86400, // 24 hours
    storage: 35,
    memory: 29,
    cpu: 25,
    lastSeen: minutesAgo(1),
    alerts: [],
  },
  {
    id: "PLAYER-007",
    name: "Warehouse Display",
    location: "Warehouse - Shipping Dock",
    tenant: "RetailMax",
    status: "warning",
    uptime: 43200, // 12 hours
    storage: 72,
    memory: 91,
    cpu: 45,
    lastSeen: minutesAgo(1),
    alerts: [
      { id: 1, type: "warning", message: "Memory usage critically high", timestamp: minutesAgo(5) },
    ],
  },
  {
    id: "PLAYER-008",
    name: "Break Room Screen",
    location: "Building A - Floor 2",
    tenant: "Acme Corp",
    status: "warning",
    uptime: 86400, // 1 day
    storage: 55,
    memory: 67,
    cpu: 82,
    lastSeen: minutesAgo(2),
    alerts: [
      { id: 1, type: "warning", message: "CPU usage above threshold", timestamp: minutesAgo(15) },
    ],
  },
  {
    id: "PLAYER-009",
    name: "Outdoor Kiosk",
    location: "Main Building - Entrance",
    tenant: "TechStart Inc",
    status: "warning",
    uptime: 3600, // 1 hour
    storage: 92,
    memory: 88,
    cpu: 78,
    lastSeen: secondsAgo(30),
    alerts: [
      { id: 1, type: "warning", message: "Storage usage critical - 92%", timestamp: hoursAgo(1) },
      { id: 2, type: "warning", message: "Memory usage high - 88%", timestamp: minutesAgo(45) },
      { id: 3, type: "warning", message: "CPU usage elevated - 78%", timestamp: minutesAgo(30) },
    ],
  },
  {
    id: "PLAYER-010",
    name: "Training Room Display",
    location: "Building B - Floor 2",
    tenant: "Acme Corp",
    status: "online",
    uptime: 57600, // 16 hours
    storage: 48,
    memory: 52,
    cpu: 35,
    lastSeen: minutesAgo(4),
    alerts: [],
  },
]

// API functions
export async function fetchPlayers(): Promise<Player[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 2000))
  return players
}

