import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useEffect, useMemo, useState } from 'react'

import {
  CreateDeviceBody,
  ListDevicesResponse,
  ListGroupsResponse,
  DeviceSchema,
  UpdateDeviceBody,
  type Device,
  type Group,
  GroupSchema,
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
import { Check, ChevronDown, ChevronRight, Copy, Loader2, Pencil, Plus, RefreshCw, XCircle } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export const Route = createFileRoute('/players')({
  component: RouteComponent,
})

function coerceDevice(
  raw:
    | Device
    | (Omit<Device, 'createdAt' | 'updatedAt'> & {
        createdAt: string | Date
        updatedAt: string | Date
      })
): Device {
  return DeviceSchema.parse({
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  })
}

function coerceGroup(
  raw:
    | Group
    | (Omit<Group, 'createdAt' | 'updatedAt'> & {
        createdAt: string | Date
        updatedAt: string | Date
      })
): Group {
  return GroupSchema.parse({
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  })
}


async function fetchDevices(): Promise<Device[]> {
  const response = await fetch('/api/devices')
  if (!response.ok) {
    throw new Error('Failed to load devices')
  }
  if (response.status === 204) {
    return []
  }
  const text = await response.text()
  if (!text) {
    return []
  }
  const data = JSON.parse(text)
  const parsed = ListDevicesResponse.parse({
    devices: Array.isArray(data?.devices) ? data.devices.map(coerceDevice) : [],
  })
  return parsed.devices
}

async function fetchGroups(): Promise<Group[]> {
  const response = await fetch('/api/groups')
  if (!response.ok) {
    throw new Error('Failed to load groups')
  }
  const data = await response.json()
  const parsed = ListGroupsResponse.parse({
    groups: Array.isArray(data?.groups) ? data.groups.map(coerceGroup) : [],
  })
  return parsed.groups
}

async function createDevice(input: CreateDeviceBody): Promise<Device> {
  const response = await fetch('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to create device')
  }
  return coerceDevice(data)
}

async function updateDevice(id: string, input: UpdateDeviceBody): Promise<Device> {
  const response = await fetch(`/api/devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to update device')
  }
  return coerceDevice(data)
}

async function deleteDevice(id: string): Promise<void> {
  const response = await fetch(`/api/devices/${id}`, {
    method: 'DELETE',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to delete device')
  }
}

async function rotateApiKey(id: string): Promise<Device> {
  const response = await fetch(`/api/devices/${id}/rotate-key`, {
    method: 'POST',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to rotate API key')
  }
  return coerceDevice(data)
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
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    error: devicesError,
  } = useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
  })

  const {
    data: groups = [],
    isLoading: isGroupsLoading,
    error: groupsError,
  } = useQuery({
    queryKey: ['groups'],
    queryFn: fetchGroups,
  })

  const groupMap = useMemo(() => {
    return new Map(groups.map((group) => [group.id, group.name]))
  }, [groups])

  const createMutation = useMutation({
    mutationFn: createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDeviceBody }) =>
      updateDevice(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setDialogOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })

  const rotateMutation = useMutation({
    mutationFn: rotateApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })

  const form = useForm({
    defaultValues: {
      name: '',
      hostname: '',
      groupId: '',
      description: '',
      location: '',
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      const trimmedName = value.name.trim()
      const trimmedHostname = value.hostname.trim().toUpperCase()
      const trimmedDescription = value.description.trim()
      const trimmedLocation = value.location.trim()

      if (!editingDevice) {
        const parsed = CreateDeviceBody.safeParse({
          name: trimmedName,
          hostname: trimmedHostname,
          groupId: value.groupId,
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

      const updatePayload: UpdateDeviceBody = {}
      if (trimmedName !== editingDevice.name) {
        updatePayload.name = trimmedName
      }
      if (trimmedHostname !== editingDevice.hostname) {
        updatePayload.hostname = trimmedHostname
      }
      if (value.groupId !== editingDevice.groupId) {
        updatePayload.groupId = value.groupId
      }
      if (trimmedDescription !== editingDevice.description) {
        updatePayload.description = trimmedDescription
      }
      if (trimmedLocation !== editingDevice.location) {
        updatePayload.location = trimmedLocation
      }

      if (Object.keys(updatePayload).length === 0) {
        setSubmitError('No changes to save')
        return
      }

      const parsed = UpdateDeviceBody.safeParse(updatePayload)
      if (!parsed.success) {
        setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
        return
      }

      await updateMutation.mutateAsync({ id: editingDevice.id, input: parsed.data })
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending || form.state.isSubmitting
  const isDeleting = deleteMutation.isPending

  useEffect(() => {
    if (!dialogOpen) return
    if (editingDevice) {
      form.reset({
        name: editingDevice.name,
        hostname: editingDevice.hostname.toUpperCase(),
        groupId: editingDevice.groupId,
        description: editingDevice.description ?? '',
        location: editingDevice.location ?? '',
      })
    } else {
      form.reset({
        name: '',
        hostname: '',
        groupId: groups[0]?.id ?? '',
        description: '',
        location: '',
      })
    }
  }, [dialogOpen, editingDevice, form, groups])

  function openCreateDialog() {
    setEditingDevice(null)
    setSubmitError(null)
    setDialogOpen(true)
  }

  function openEditDialog(device: Device) {
    setEditingDevice(device)
    setSubmitError(null)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditingDevice(null)
      setSubmitError(null)
      form.reset()
    }
  }

  function openDeleteDialog(device: Device) {
    setDeviceToDelete(device)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!deviceToDelete) return
    setSubmitError(null)
    await deleteMutation.mutateAsync(deviceToDelete.id)
    setDeleteDialogOpen(false)
    setDeviceToDelete(null)
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    setDeleteDialogOpen(open)
    if (!open) {
      setDeviceToDelete(null)
    }
  }

  function toggleRow(deviceId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(deviceId)) {
        next.delete(deviceId)
      } else {
        next.add(deviceId)
      }
      return next
    })
  }

  async function copyApiKey(apiKey: string, deviceId: string) {
    await navigator.clipboard.writeText(apiKey)
    setCopiedKey(deviceId)
    setTimeout(() => setCopiedKey(null), 2000)
  }


  if (isDevicesLoading || isGroupsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading devices...</p>
        </div>
      </div>
    )
  }

  if (devicesError || groupsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-foreground font-medium">Failed to load devices</p>
            <p className="text-muted-foreground text-sm">
              {devicesError instanceof Error
                ? devicesError.message
                : groupsError instanceof Error
                  ? groupsError.message
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
            <h1 className="text-xl font-semibold text-foreground">Devices</h1>
            <p className="text-sm text-muted-foreground">Manage device players</p>
          </div>
          <Button onClick={openCreateDialog} disabled={groups.length === 0}>
            <Plus className="h-4 w-4" />
            Add Device
          </Button>
        </div>

        <Card className="flex-1 min-h-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
            <div>
              <CardTitle>All Devices</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-2">
                {devices.length} total
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Name</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No devices yet
                    </TableCell>
                  </TableRow>
                )}
                {devices.map((device) => (
                  <Collapsible
                    key={device.id}
                    open={expandedRows.has(device.id)}
                    onOpenChange={() => toggleRow(device.id)}
                    asChild
                  >
                    <>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <CollapsibleTrigger asChild>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {expandedRows.has(device.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              {device.name}
                            </div>
                          </TableCell>
                        </CollapsibleTrigger>
                        <TableCell className="text-muted-foreground">
                          {device.hostname.toUpperCase()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {groupMap.get(device.groupId) ?? device.groupId}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {device.location || '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {formatDate(device.createdAt)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {formatDate(device.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditDialog(device)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isDeleting}
                              onClick={(e) => {
                                e.stopPropagation()
                                openDeleteDialog(device)
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="py-4">
                            <div className="pl-6 space-y-3">
                              <div className="text-sm font-medium text-foreground">API Key</div>
                              <div className="flex items-center gap-3">
                                <code className="flex-1 bg-background border rounded-md px-3 py-2 text-sm font-mono text-muted-foreground truncate">
                                  {device.apiKey || 'No API key generated'}
                                </code>
                                {device.apiKey && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyApiKey(device.apiKey, device.id)}
                                  >
                                    {copiedKey === device.id ? (
                                      <>
                                        <Check className="h-4 w-4 text-green-500" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-4 w-4" />
                                        Copy
                                      </>
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={rotateMutation.isPending}
                                  onClick={() => rotateMutation.mutate(device.id)}
                                >
                                  {rotateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                  Rotate
                                </Button>
                              </div>
                              {device.apiKeyId && (
                                <p className="text-xs text-muted-foreground">
                                  Key ID: {device.apiKeyId}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDevice ? 'Edit device' : 'Add device'}</DialogTitle>
            <DialogDescription>
              {editingDevice
                ? 'Update the device details and save changes.'
                : 'Create a new device.'}
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
                  const parsed = CreateDeviceBody.shape.name.safeParse(value.trim())
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
                  const parsed = CreateDeviceBody.shape.hostname.safeParse(value.trim())
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
                    placeholder="device-001.local"
                  />
                  {field.state.meta.errors?.[0] && (
                    <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="groupId"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Select a group'
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Group</label>
                  <Select value={field.state.value} onValueChange={field.handleChange}>
                    <SelectTrigger className="w-full" onBlur={field.handleBlur}>
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.length === 0 && (
                        <SelectItem value="none" disabled>
                          No groups available
                        </SelectItem>
                      )}
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
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
                    : 'Failed to save device'}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingDevice ? 'Save changes' : 'Create device'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete device</AlertDialogTitle>
            <AlertDialogDescription>
              {deviceToDelete
                ? `This will permanently delete ${deviceToDelete.name}. This action cannot be undone.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error && (
            <p className="text-sm text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : 'Failed to delete device'}
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
