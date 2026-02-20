import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, AlertTriangle, ChevronDown, Clock, HardDrive, Info, Loader2, MapPin, Monitor, WifiOff, XCircle } from "lucide-react"
import { fetchMonitoredDevices } from "@/api/players"
import type { Alert, MonitoredDevice } from '@dstelemetry/types'
import { formatUptime, formatRelativeTime } from "@/lib/utils"

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function AlertIcon({ type }: { type: string }) {
  switch (type) {
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-warning" />
    default:
      return <Info className="h-4 w-4 text-primary" />
  }
}

const STORAGE_WARNING_THRESHOLD = 80
const MEMORY_WARNING_THRESHOLD = 85
const CPU_WARNING_THRESHOLD = 75

function MonitoredDeviceRow({ device }: { device: MonitoredDevice }) {
  const [isOpen, setIsOpen] = useState(false)
  const hasAlerts = device.alerts.length > 0
  
  const storageWarning = device.storage >= STORAGE_WARNING_THRESHOLD
  const memoryWarning = device.memory >= MEMORY_WARNING_THRESHOLD
  const cpuWarning = device.cpu >= CPU_WARNING_THRESHOLD
  
  const displayStorage = device.status === "offline" ? "0%" : `${Number(device.storage).toFixed(0)}%`
  const displayMemory = device.status === "offline" ? "0%" : `${Number(device.memory).toFixed(0)}%`
  const displayCpu = device.status === "offline" ? "0%" : `${Number(device.cpu).toFixed(0)}%`

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <>
        <TableRow
          className={hasAlerts ? "cursor-pointer" : ""}
          onClick={() => hasAlerts && setIsOpen(!isOpen)}
        >
          <TableCell className="py-4">
            <div className="flex items-center gap-4">
              <div className="w-4 flex items-center justify-center">
                {hasAlerts && (
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-normal text-foreground">{device.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{device.hostname}</span>
              </div>
            </div>
          </TableCell>
          <TableCell className="hidden lg:table-cell py-4">
            <div className="flex items-center gap-2 font-extralight text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{device.location}</span>
            </div>
          </TableCell>
          <TableCell className="py-4">
            <Badge
              variant="outline"
              className={
                device.status === "online"
                  ? "border-[0.25px] border-success bg-success/6 text-success capitalize py-1"
                  : device.status === "warning"
                    ? "border-[0.25px] border-warning bg-warning/6 text-warning capitalize py-1"
                    : "border-[0.25px] border-destructive bg-destructive/6 text-destructive capitalize py-1"
              }
            >
              {device.status === "online" ? "Online" : device.status === "warning" ? "Warning" : "Offline"}
            </Badge>
          </TableCell>
          <TableCell className="py-4">
            <span className="font-extralight text-muted-foreground">{formatUptime(device.uptime)}</span>
          </TableCell>
          <TableCell className={`py-4 ${storageWarning ? (device.storage >= 95 ? "text-destructive font-medium" : "text-warning font-medium") : "text-muted-foreground"}`}>
            {displayStorage}
          </TableCell>
          <TableCell className={`py-4 ${memoryWarning ? (device.memory >= 95 ? "text-destructive font-medium" : "text-warning font-medium") : "text-muted-foreground"}`}>
            {displayMemory}
          </TableCell>
          <TableCell className={`py-4 ${cpuWarning ? (device.cpu >= 95 ? "text-destructive font-medium" : "text-warning font-medium") : "text-muted-foreground"}`}>
            {displayCpu}
          </TableCell>
          <TableCell className="py-4">
            <div className="flex items-center gap-2 font-extralight text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatRelativeTime(device.lastSeen)}</span>
            </div>
          </TableCell>
        </TableRow>
        {hasAlerts && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={9} className="p-0 border-0">
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapse data-[state=open]:animate-expand">
                <div className="bg-muted/30 border-t border-b border-border/50 px-8 py-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Alerts ({device.alerts.length})
                  </div>
                  <div className="space-y-2">
                    {device.alerts.map((alert: Alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start gap-3 text-sm"
                      >
                        <AlertIcon type={alert.type} />
                        <div className="flex-1">
                          <span className="text-foreground">{alert.message}</span>
                          <span className="text-muted-foreground ml-2">· {formatRelativeTime(alert.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </TableCell>
          </TableRow>
        )}
      </>
    </Collapsible>
  )
}

function RouteComponent() {
  const [selectedTenant, setSelectedTenant] = useState<string>("all")
  
  const { data: monitoredDevices = [], isLoading, error } = useQuery({
    queryKey: ['monitored-devices'],
    queryFn: fetchMonitoredDevices,
  })
  
  const tenants = [...new Set(monitoredDevices.map(d => d.tenant))]
  const filteredMonitoredDevices = selectedTenant === "all"
    ? monitoredDevices
    : monitoredDevices.filter(d => d.tenant === selectedTenant)
  
  const onlineCount = filteredMonitoredDevices.filter((d) => d.status === "online").length
  const warningCount = filteredMonitoredDevices.filter((d) => d.status === "warning").length
  const offlineCount = filteredMonitoredDevices.filter((d) => d.status === "offline").length
  const totalMonitoredDevices = filteredMonitoredDevices.length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading monitored devices...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-foreground font-medium">Failed to load monitored devices</p>
            <p className="text-muted-foreground text-sm">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-background p-6 md:p-8 flex flex-col">
      <div className="mx-auto max-w-7xl w-full flex flex-col flex-1 min-h-0 gap-8">

        {/* Tenant Filter */}
        <div className="flex justify-end shrink-0">
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              {tenants.map((tenant) => (
                <SelectItem key={tenant} value={tenant}>
                  {tenant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Players</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMonitoredDevices}</div>
              <p className="text-xs text-muted-foreground">
                {selectedTenant === "all" ? "Across all tenants" : selectedTenant}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <Activity className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{onlineCount}</div>
              <p className="text-xs text-muted-foreground">
                {totalMonitoredDevices > 0 ? ((onlineCount / totalMonitoredDevices) * 100).toFixed(0) : 0}% operational
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <HardDrive className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{warningCount}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <WifiOff className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{offlineCount}</div>
              <p className="text-xs text-muted-foreground">Need immediate action</p>
            </CardContent>
          </Card>
        </div>

        {/* Players Table */}
        <Card className="flex-1 min-h-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
            <div>
              <CardTitle>All Players</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-2">Updated every 60 seconds</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Player</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Memory</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMonitoredDevices.map((d) => (
                  <MonitoredDeviceRow key={d.id} device={d} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
