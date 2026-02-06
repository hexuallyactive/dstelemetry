import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, AlertTriangle, ChevronDown, Clock, HardDrive, Info, Loader2, MapPin, Monitor, WifiOff, XCircle } from "lucide-react"
import { fetchPlayers, type Player, type Alert } from "@/api/players"
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

function PlayerRow({ player }: { player: Player }) {
  const [isOpen, setIsOpen] = useState(false)
  const hasAlerts = player.alerts.length > 0
  
  const storageWarning = player.storage >= STORAGE_WARNING_THRESHOLD
  const memoryWarning = player.memory >= MEMORY_WARNING_THRESHOLD
  const cpuWarning = player.cpu >= CPU_WARNING_THRESHOLD
  
  const displayStorage = player.status === "offline" ? "0%" : `${player.storage}%`
  const displayMemory = player.status === "offline" ? "0%" : `${player.memory}%`
  const displayCpu = player.status === "offline" ? "0%" : `${player.cpu}%`

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
                <span className="font-normal text-foreground">{player.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{player.id}</span>
              </div>
            </div>
          </TableCell>
          <TableCell className="hidden lg:table-cell py-4">
            <div className="flex items-center gap-2 font-extralight text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{player.location}</span>
            </div>
          </TableCell>
          <TableCell className="py-4">
            <Badge
              variant="outline"
              className={
                player.status === "online"
                  ? "border-[0.25px] border-success bg-success/6 text-success capitalize py-1"
                  : player.status === "warning"
                    ? "border-[0.25px] border-warning bg-warning/6 text-warning capitalize py-1"
                    : "border-[0.25px] border-destructive bg-destructive/6 text-destructive capitalize py-1"
              }
            >
              {player.status === "online" ? "Online" : player.status === "warning" ? "Warning" : "Offline"}
            </Badge>
          </TableCell>
          <TableCell className="py-4">
            <span className="font-extralight text-muted-foreground">{formatUptime(player.uptime)}</span>
          </TableCell>
          <TableCell className={`py-4 ${storageWarning ? (player.storage >= 95 ? "text-destructive font-medium" : "text-warning font-medium") : "text-muted-foreground"}`}>
            {displayStorage}
          </TableCell>
          <TableCell className={`py-4 ${memoryWarning ? (player.memory >= 95 ? "text-destructive font-medium" : "text-warning font-medium") : "text-muted-foreground"}`}>
            {displayMemory}
          </TableCell>
          <TableCell className={`py-4 ${cpuWarning ? (player.cpu >= 95 ? "text-destructive font-medium" : "text-warning font-medium") : "text-muted-foreground"}`}>
            {displayCpu}
          </TableCell>
          <TableCell className="py-4">
            <div className="flex items-center gap-2 font-extralight text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatRelativeTime(player.lastSeen)}</span>
            </div>
          </TableCell>
        </TableRow>
        {hasAlerts && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={9} className="p-0 border-0">
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapse data-[state=open]:animate-expand">
                <div className="bg-muted/30 border-t border-b border-border/50 px-8 py-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Alerts ({player.alerts.length})
                  </div>
                  <div className="space-y-2">
                    {player.alerts.map((alert: Alert) => (
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
  
  const { data: players = [], isLoading, error } = useQuery({
    queryKey: ['monitored-players'],
    queryFn: fetchPlayers,
  })
  
  const tenants = [...new Set(players.map(p => p.tenant))]
  const filteredPlayers = selectedTenant === "all"
    ? players
    : players.filter(p => p.tenant === selectedTenant)
  
  const onlineCount = filteredPlayers.filter((p) => p.status === "online").length
  const warningCount = filteredPlayers.filter((p) => p.status === "warning").length
  const offlineCount = filteredPlayers.filter((p) => p.status === "offline").length
  const totalPlayers = filteredPlayers.length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading players...</p>
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
            <p className="text-foreground font-medium">Failed to load players</p>
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
              <div className="text-2xl font-bold">{totalPlayers}</div>
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
                {totalPlayers > 0 ? ((onlineCount / totalPlayers) * 100).toFixed(0) : 0}% operational
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
                {filteredPlayers.map((player) => (
                  <PlayerRow key={player.id} player={player} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
