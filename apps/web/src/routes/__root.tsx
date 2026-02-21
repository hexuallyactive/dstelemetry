import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'
import StatusIndicator from '@/components/StatusIndicator'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-lg px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <StatusIndicator />
        </header>
        <Outlet />
      </SidebarInset>
      {import.meta.env.DEV && true && (
      <TanStackDevtools
        config={{
          position: 'bottom-right',
          theme: 'dark'
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: (<TanStackRouterDevtoolsPanel />),
          },
          TanStackQueryDevtools,
        ]}
      />
      )}
    </SidebarProvider>
  ),
})
