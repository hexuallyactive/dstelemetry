import { useIsFetching, useQueryClient } from '@tanstack/react-query'

export type ConnectionStatus = 'online' | 'offline' | 'loading'

interface StatusIndicatorProps {
  status?: ConnectionStatus
}

function useConnectionStatus(): ConnectionStatus {
  const queryClient = useQueryClient()
  const isFetching = useIsFetching()
  
  // Check if we're currently fetching any data
  if (isFetching > 0) {
    return 'loading'
  }
  
  // Check the players query state to determine online/offline
  const playersQueryState = queryClient.getQueryState(['players'])
  
  if (playersQueryState?.status === 'error') {
    return 'offline'
  }
  
  if (playersQueryState?.status === 'success') {
    return 'online'
  }
  
  // Default to loading if no query has been made yet
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

