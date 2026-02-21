import { useQuery } from '@tanstack/react-query'
import { fetchMonitoredDevices } from '@/api/players'

export type ConnectionStatus = 'online' | 'offline' | 'loading'

interface StatusIndicatorProps {
  status?: ConnectionStatus
}

function useConnectionStatus(): ConnectionStatus {
  const { isSuccess, isError, isStale, isFetching } = useQuery({
    queryKey: ['monitored-devices'],
    queryFn: fetchMonitoredDevices,
    staleTime: 1000 * 20, // Match index.tsx - must align for isStale to work
    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: false,
  })

  if (isError) return 'offline'
  if (isSuccess && (isStale || isFetching)) return 'loading' // Stale or refetching → yellow
  if (isSuccess) return 'online'
  if (isFetching) return 'loading'
  return 'loading'
}

export default function StatusIndicator({ status: statusProp }: StatusIndicatorProps) {
  const autoStatus = useConnectionStatus()
  const status = statusProp ?? autoStatus
  
  const statusConfig = {
    online: {
      color: 'bg-success',
      pulse: true,
      label: 'Online',
    },
    offline: {
      color: 'bg-destructive',
      pulse: false,
      label: 'Offline',
    },
    loading: {
      color: 'bg-warning',
      pulse: true,
      label: 'Loading',
    },
  }
  
  const config = statusConfig[status]
  
  return (
    <div className="flex items-center gap-2">
    {/* Label 
      <span className="text-xs text-muted-foreground hidden sm:block">
        {config.label}
      </span>
      */}
      <div className="relative flex items-center justify-center">
        {/* Outer ring for pulse effect */}
        {config.pulse && (
          <div
            className={`absolute h-3 w-3 rounded-full ${config.color} opacity-40 animate-led-pulse`}
          />
        )}
        {/* Main LED */}
        <div
          className={`h-2.5 w-2.5 rounded-full ${config.color}`}
        />
      </div>
    </div>
  )
}

