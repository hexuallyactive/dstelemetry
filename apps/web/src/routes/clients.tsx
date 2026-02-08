import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useEffect, useState } from 'react'

import {
  CreateTenantBody,
  ListTenantsResponse,
  TenantSchema,
  UpdateTenantBody,
  type Tenant,
} from '@dstelemetry/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Pencil, Plus, XCircle } from 'lucide-react'

export const Route = createFileRoute('/clients')({
  component: RouteComponent,
})

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

async function fetchTenants(): Promise<Tenant[]> {
  const response = await fetch('/api/tenants')
  if (!response.ok) {
    throw new Error('Failed to load clients')
  }
  const data = await response.json()
  const parsed = ListTenantsResponse.parse({
    tenants: Array.isArray(data?.tenants) ? data.tenants.map(coerceTenant) : [],
  })
  return parsed.tenants
}

async function createTenant(input: CreateTenantBody): Promise<Tenant> {
  const response = await fetch('/api/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to create client')
  }
  return coerceTenant(data)
}

async function updateTenant(id: string, input: UpdateTenantBody): Promise<Tenant> {
  const response = await fetch(`/api/tenants/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to update client')
  }
  return coerceTenant(data)
}

async function deleteTenant(id: string): Promise<void> {
  const response = await fetch(`/api/tenants/${id}`, {
    method: 'DELETE',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to delete client')
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
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: tenants = [], isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: fetchTenants,
  })

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTenantBody }) =>
      updateTenant(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setDialogOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      const trimmedName = value.name.trim()
      const trimmedDescription = value.description.trim()

      if (!editingTenant) {
        const parsed = CreateTenantBody.safeParse({
          name: trimmedName,
          description: trimmedDescription,
        })
        if (!parsed.success) {
          setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
          return
        }
        await createMutation.mutateAsync(parsed.data)
        return
      }

      const updatePayload: UpdateTenantBody = {}
      if (trimmedName !== editingTenant.name) {
        updatePayload.name = trimmedName
      }
      if (trimmedDescription !== editingTenant.description) {
        updatePayload.description = trimmedDescription
      }

      if (Object.keys(updatePayload).length === 0) {
        setSubmitError('No changes to save')
        return
      }

      const parsed = UpdateTenantBody.safeParse(updatePayload)
      if (!parsed.success) {
        setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
        return
      }

      await updateMutation.mutateAsync({ id: editingTenant.id, input: parsed.data })
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending || form.state.isSubmitting
  const isDeleting = deleteMutation.isPending

  useEffect(() => {
    if (!dialogOpen) return
    if (editingTenant) {
      form.reset({
        name: editingTenant.name,
        description: editingTenant.description ?? '',
      })
    } else {
      form.reset({   
        name: '',
        description: '',
      })
    }
  }, [dialogOpen, editingTenant, form])

  function openCreateDialog() {
    setEditingTenant(null)
    setSubmitError(null)
    setDialogOpen(true)
  }

  function openEditDialog(tenant: Tenant) {
    setEditingTenant(tenant)
    setSubmitError(null)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditingTenant(null)
      setSubmitError(null)
      form.reset()
    }
  }

  function openDeleteDialog(tenant: Tenant) {
    setTenantToDelete(tenant)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!tenantToDelete) return
    setSubmitError(null)
    await deleteMutation.mutateAsync(tenantToDelete.id)
    setDeleteDialogOpen(false)
    setTenantToDelete(null)
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    setDeleteDialogOpen(open)
    if (!open) {
      setTenantToDelete(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading clients...</p>
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
            <p className="text-foreground font-medium">Failed to load clients</p>
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
      <div className="mx-auto max-w-7xl w-full flex flex-col flex-1 min-h-0 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground">Manage tenants for your deployment</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>

        <Card className="flex-1 min-h-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
            <div>
              <CardTitle>All Clients</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-2">
                {tenants.length} total
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No clients yet
                    </TableCell>
                  </TableRow>
                )}
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {tenant.description || '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatDate(tenant.createdAt)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatDate(tenant.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(tenant)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => openDeleteDialog(tenant)}
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
            <DialogTitle>{editingTenant ? 'Edit client' : 'Add client'}</DialogTitle>
            <DialogDescription>
              {editingTenant
                ? 'Update the client details and save changes.'
                : 'Create a new client for your deployment.'}
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
                  const parsed = CreateTenantBody.shape.name.safeParse(value.trim())
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
                    placeholder="Acme Corp"
                    autoFocus
                  />
                  {field.state.meta.errors?.[0] && (
                    <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                  )}
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
                    placeholder="Enterprise signage rollout"
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
                    : 'Failed to save client'}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingTenant ? 'Save changes' : 'Create client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client</AlertDialogTitle>
            <AlertDialogDescription>
              {tenantToDelete
                ? `This will permanently delete ${tenantToDelete.name}. This action cannot be undone.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error && (
            <p className="text-sm text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : 'Failed to delete client'}
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
