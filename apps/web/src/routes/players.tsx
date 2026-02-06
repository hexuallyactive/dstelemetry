import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useEffect, useMemo, useState } from 'react'

import {
  CreatePlayerBody,
  ListPlayersResponse,
  ListTenantsResponse,
  PlayerSchema,
  UpdatePlayerBody,
  type Player,
  type Tenant,
  TenantSchema,
} from '@dstelemetry/types'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Pencil, Plus, XCircle } from 'lucide-react'

export const Route = createFileRoute('/players')({
  component: RouteComponent,
})

function coercePlayer(
  raw:
    | Player
    | (Omit<Player, 'createdAt' | 'updatedAt'> & {
        createdAt: string | Date
        updatedAt: string | Date
      })
): Player {
  return PlayerSchema.parse({
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  })
}

function coerceTenant(
  raw:
    | Tenant
    | (Omit<Tenant, 'createdAt' | 'updatedAt'> & {
        createdAt: string | Date
        updatedAt: string | Date
      })
): Tenant {
  return TenantSchema.parse({
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  })
}

async function fetchPlayers(): Promise<Player[]> {
  const response = await fetch('/api/players')
  if (!response.ok) {
    throw new Error('Failed to load players')
  }
  const data = await response.json()
  const parsed = ListPlayersResponse.parse({
    players: Array.isArray(data?.players) ? data.players.map(coercePlayer) : [],
  })
  return parsed.players
}

async function fetchTenants(): Promise<Tenant[]> {
  const response = await fetch('/api/tenants')
  if (!response.ok) {
    throw new Error('Failed to load tenants')
  }
  const data = await response.json()
  const parsed = ListTenantsResponse.parse({
    tenants: Array.isArray(data?.tenants) ? data.tenants.map(coerceTenant) : [],
  })
  return parsed.tenants
}

async function createPlayer(input: CreatePlayerBody): Promise<Player> {
  const response = await fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to create player')
  }
  return coercePlayer(data)
}

async function updatePlayer(id: string, input: UpdatePlayerBody): Promise<Player> {
  const response = await fetch(`/api/players/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to update player')
  }
  return coercePlayer(data)
}

async function deletePlayer(id: string): Promise<void> {
  const response = await fetch(`/api/players/${id}`, {
    method: 'DELETE',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to delete player')
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    data: players = [],
    isLoading: isPlayersLoading,
    error: playersError,
  } = useQuery({
    queryKey: ['players'],
    queryFn: fetchPlayers,
  })

  const {
    data: tenants = [],
    isLoading: isTenantsLoading,
    error: tenantsError,
  } = useQuery({
    queryKey: ['tenants'],
    queryFn: fetchTenants,
  })

  const tenantMap = useMemo(() => {
    return new Map(tenants.map((tenant) => [tenant.id, tenant.name]))
  }, [tenants])

  const createMutation = useMutation({
    mutationFn: createPlayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlayerBody }) =>
      updatePlayer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setDialogOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
  })

  const form = useForm({
    defaultValues: {
      name: '',
      hostname: '',
      tenantId: '',
      description: '',
      location: '',
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      const trimmedName = value.name.trim()
      const trimmedHostname = value.hostname.trim().toUpperCase()
      const trimmedDescription = value.description.trim()
      const trimmedLocation = value.location.trim()

      if (!editingPlayer) {
        const parsed = CreatePlayerBody.safeParse({
          name: trimmedName,
          hostname: trimmedHostname,
          tenantId: value.tenantId,
          description: trimmedDescription,
          location: trimmedLocation,
        })
        if (!parsed.success) {
          setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
          return
        }
        await createMutation.mutateAsync(parsed.data)
        return
      }

      const updatePayload: UpdatePlayerBody = {}
      if (trimmedName !== editingPlayer.name) {
        updatePayload.name = trimmedName
      }
      if (trimmedHostname !== editingPlayer.hostname) {
        updatePayload.hostname = trimmedHostname
      }
      if (value.tenantId !== editingPlayer.tenantId) {
        updatePayload.tenantId = value.tenantId
      }
      if (trimmedDescription !== editingPlayer.description) {
        updatePayload.description = trimmedDescription
      }
      if (trimmedLocation !== editingPlayer.location) {
        updatePayload.location = trimmedLocation
      }

      if (Object.keys(updatePayload).length === 0) {
        setSubmitError('No changes to save')
        return
      }

      const parsed = UpdatePlayerBody.safeParse(updatePayload)
      if (!parsed.success) {
        setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
        return
      }

      await updateMutation.mutateAsync({ id: editingPlayer.id, input: parsed.data })
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending || form.state.isSubmitting
  const isDeleting = deleteMutation.isPending

  useEffect(() => {
    if (!dialogOpen) return
    if (editingPlayer) {
      form.reset({
        name: editingPlayer.name,
        hostname: editingPlayer.hostname.toUpperCase(),
        tenantId: editingPlayer.tenantId,
        description: editingPlayer.description ?? '',
        location: editingPlayer.location ?? '',
      })
    } else {
      form.reset({
        name: '',
        hostname: '',
        tenantId: tenants[0]?.id ?? '',
        description: '',
        location: '',
      })
    }
  }, [dialogOpen, editingPlayer, form, tenants])

  function openCreateDialog() {
    setEditingPlayer(null)
    setSubmitError(null)
    setDialogOpen(true)
  }

  function openEditDialog(player: Player) {
    setEditingPlayer(player)
    setSubmitError(null)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditingPlayer(null)
      setSubmitError(null)
      form.reset()
    }
  }

  function openDeleteDialog(player: Player) {
    setPlayerToDelete(player)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!playerToDelete) return
    setSubmitError(null)
    await deleteMutation.mutateAsync(playerToDelete.id)
    setDeleteDialogOpen(false)
    setPlayerToDelete(null)
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    setDeleteDialogOpen(open)
    if (!open) {
      setPlayerToDelete(null)
    }
  }

  if (isPlayersLoading || isTenantsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading players...</p>
        </div>
      </div>
    )
  }

  if (playersError || tenantsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-foreground font-medium">Failed to load players</p>
            <p className="text-muted-foreground text-sm">
              {playersError instanceof Error
                ? playersError.message
                : tenantsError instanceof Error
                  ? tenantsError.message
                  : 'An unexpected error occurred'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-background p-6 md:p-8 flex flex-col">
      <div className="mx-auto max-w-7xl w-full flex flex-col flex-1 min-h-0 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Players</h1>
            <p className="text-sm text-muted-foreground">Manage player devices</p>
          </div>
          <Button onClick={openCreateDialog} disabled={tenants.length === 0}>
            <Plus className="h-4 w-4" />
            Add Player
          </Button>
        </div>

        <Card className="flex-1 min-h-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
            <div>
              <CardTitle>All Players</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-2">
                {players.length} total
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Name</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No players yet
                    </TableCell>
                  </TableRow>
                )}
                {players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {player.hostname.toUpperCase()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tenantMap.get(player.tenantId) ?? player.tenantId}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {player.location || '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatDate(player.createdAt)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatDate(player.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(player)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => openDeleteDialog(player)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlayer ? 'Edit player' : 'Add player'}</DialogTitle>
            <DialogDescription>
              {editingPlayer
                ? 'Update the player details and save changes.'
                : 'Create a new player device.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              form.handleSubmit()
            }}
            className="space-y-4"
          >
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const parsed = CreatePlayerBody.shape.name.safeParse(value.trim())
                  return parsed.success ? undefined : parsed.error.issues[0]?.message
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Name</label>
                  <Input
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Lobby Display 1"
                    autoFocus
                  />
                  {field.state.meta.errors?.[0] && (
                    <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="hostname"
              validators={{
                onChange: ({ value }) => {
                  const parsed = CreatePlayerBody.shape.hostname.safeParse(value.trim())
                  return parsed.success ? undefined : parsed.error.issues[0]?.message
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Hostname</label>
                  <Input
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.target.value.toUpperCase())
                    }
                    onBlur={field.handleBlur}
                    placeholder="player-001.local"
                  />
                  {field.state.meta.errors?.[0] && (
                    <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="tenantId"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Select a tenant'
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tenant</label>
                  <Select value={field.state.value} onValueChange={field.handleChange}>
                    <SelectTrigger className="w-full" onBlur={field.handleBlur}>
                      <SelectValue placeholder="Select a tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.length === 0 && (
                        <SelectItem value="none" disabled>
                          No tenants available
                        </SelectItem>
                      )}
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors?.[0] && (
                    <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="location">
              {(field) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Location</label>
                  <Input
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Main Building - Lobby"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Input
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Main lobby display"
                  />
                </div>
              )}
            </form.Field>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            {(createMutation.error || updateMutation.error) && (
              <p className="text-sm text-destructive">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : 'Failed to save player'}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingPlayer ? 'Save changes' : 'Create player'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete player</AlertDialogTitle>
            <AlertDialogDescription>
              {playerToDelete
                ? `This will permanently delete ${playerToDelete.name}. This action cannot be undone.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error && (
            <p className="text-sm text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : 'Failed to delete player'}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
