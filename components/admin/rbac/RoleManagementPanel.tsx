/**
 * Role Management Panel Component
 * Epic 2 Story 2.8: Administrative interface for role management
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Plus, Edit, Trash2, Shield, Users, Clock, CheckCircle } from 'lucide-react'
import { usePermission, useUserPermissions, PermissionGuard } from '@/hooks/useRBAC'
import { Role, UserPermission } from '@/lib/rbac/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface RoleManagementPanelProps {
  className?: string
}

interface RoleAssignment {
  id: string
  user: {
    id: string
    email: string
    displayName?: string
  }
  role: Role
  grantedAt: string
  grantedBy: string
  expiresAt?: string
  isActive: boolean
  scopeType?: string
  scopeConstraints?: Record<string, any>
}

export default function RoleManagementPanel({ className }: RoleManagementPanelProps) {
  const [roles, setRoles] = useState<Role[]>([])
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Role creation/editing state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    isAssignable: true,
    requiresMfa: false
  })

  // Role assignment state
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [assignmentFormData, setAssignmentFormData] = useState({
    targetUserEmail: '',
    roleName: '',
    scopeType: 'global',
    expiresIn: '',
    justification: ''
  })

  const { hasPermission: canManageRoles } = usePermission('roles', 'manage')
  const { hasPermission: canAssignRoles } = usePermission('users', 'manage')

  // Fetch roles and assignments
  useEffect(() => {
    fetchRolesAndAssignments()
  }, [])

  const fetchRolesAndAssignments = async () => {
    try {
      setLoading(true)
      
      const [rolesResponse, assignmentsResponse] = await Promise.all([
        fetch('/api/rbac/roles?includePermissions=true&includeStats=true'),
        fetch('/api/rbac/roles?type=assignments')
      ])

      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json()
        setRoles(rolesData.data.roles)
      }

      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json()
        setRoleAssignments(assignmentsData.data.assignments || [])
      }
    } catch (err) {
      setError('Failed to fetch roles and assignments')
      console.error('Error fetching RBAC data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRole = async () => {
    try {
      const response = await fetch('/api/rbac/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...roleFormData
        })
      })

      if (response.ok) {
        await fetchRolesAndAssignments()
        setIsCreateDialogOpen(false)
        setRoleFormData({
          name: '',
          displayName: '',
          description: '',
          isAssignable: true,
          requiresMfa: false
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create role')
      }
    } catch (err) {
      setError('Failed to create role')
    }
  }

  const handleAssignRole = async () => {
    try {
      const response = await fetch('/api/rbac/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          targetUserEmail: assignmentFormData.targetUserEmail,
          roleName: assignmentFormData.roleName,
          scopeType: assignmentFormData.scopeType,
          expiresIn: assignmentFormData.expiresIn || undefined,
          justification: assignmentFormData.justification
        })
      })

      if (response.ok) {
        await fetchRolesAndAssignments()
        setIsAssignDialogOpen(false)
        setAssignmentFormData({
          targetUserEmail: '',
          roleName: '',
          scopeType: 'global',
          expiresIn: '',
          justification: ''
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to assign role')
      }
    } catch (err) {
      setError('Failed to assign role')
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Role Management</h2>
          <p className="text-muted-foreground">
            Manage system roles, permissions, and user assignments
          </p>
        </div>
        <div className="flex space-x-2">
          <PermissionGuard resource="roles" action="manage">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                  <DialogDescription>
                    Create a new role with specific permissions and settings
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="role-name">Role Name</Label>
                    <Input
                      id="role-name"
                      value={roleFormData.name}
                      onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                      placeholder="e.g., content_moderator"
                    />
                  </div>
                  <div>
                    <Label htmlFor="display-name">Display Name</Label>
                    <Input
                      id="display-name"
                      value={roleFormData.displayName}
                      onChange={(e) => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                      placeholder="e.g., Content Moderator"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={roleFormData.description}
                      onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                      placeholder="Describe the role's purpose and responsibilities"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="assignable"
                      checked={roleFormData.isAssignable}
                      onCheckedChange={(checked) => setRoleFormData({ ...roleFormData, isAssignable: checked })}
                    />
                    <Label htmlFor="assignable">Role can be assigned to users</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="requires-mfa"
                      checked={roleFormData.requiresMfa}
                      onCheckedChange={(checked) => setRoleFormData({ ...roleFormData, requiresMfa: checked })}
                    />
                    <Label htmlFor="requires-mfa">Requires MFA for assignment</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRole}>Create Role</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGuard>
          
          <PermissionGuard resource="users" action="manage">
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Assign Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Role to User</DialogTitle>
                  <DialogDescription>
                    Assign a role to a user with optional scope and expiration
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="user-email">User Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={assignmentFormData.targetUserEmail}
                      onChange={(e) => setAssignmentFormData({ ...assignmentFormData, targetUserEmail: e.target.value })}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role-select">Role</Label>
                    <Select value={assignmentFormData.roleName} onValueChange={(value) => setAssignmentFormData({ ...assignmentFormData, roleName: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.filter(role => role.isAssignable).map(role => (
                          <SelectItem key={role.id} value={role.name}>
                            {role.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="scope-type">Scope Type</Label>
                    <Select value={assignmentFormData.scopeType} onValueChange={(value) => setAssignmentFormData({ ...assignmentFormData, scopeType: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global</SelectItem>
                        <SelectItem value="business">Business Specific</SelectItem>
                        <SelectItem value="category">Category Specific</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="expires-in">Expires In (optional)</Label>
                    <Input
                      id="expires-in"
                      value={assignmentFormData.expiresIn}
                      onChange={(e) => setAssignmentFormData({ ...assignmentFormData, expiresIn: e.target.value })}
                      placeholder="e.g., 30 days, 6 months"
                    />
                  </div>
                  <div>
                    <Label htmlFor="justification">Justification</Label>
                    <Textarea
                      id="justification"
                      value={assignmentFormData.justification}
                      onChange={(e) => setAssignmentFormData({ ...assignmentFormData, justification: e.target.value })}
                      placeholder="Reason for role assignment"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAssignRole}>Assign Role</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGuard>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>System Roles</CardTitle>
              <CardDescription>
                All available roles and their configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assignable</TableHead>
                    <TableHead>Requires MFA</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{role.displayName}</div>
                          <div className="text-sm text-muted-foreground">{role.name}</div>
                          {role.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {role.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.isSystemRole ? "default" : "secondary"}>
                          {role.isSystemRole ? "System" : "Custom"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {role.isAssignable ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {role.requiresMfa && (
                          <Badge variant="outline" className="text-orange-600">
                            <Shield className="h-3 w-3 mr-1" />
                            MFA
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {roleAssignments.filter(a => a.role.id === role.id && a.isActive).length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <Edit className="h-3 w-3" />
                          </Button>
                          {!role.isSystemRole && (
                            <Button size="sm" variant="outline" className="text-red-600">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Role Assignments</CardTitle>
              <CardDescription>
                Current role assignments and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{assignment.user.displayName || assignment.user.email}</div>
                          <div className="text-sm text-muted-foreground">{assignment.user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge>{assignment.role.displayName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {assignment.scopeType || 'Global'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(assignment.grantedAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.expiresAt ? (
                          <div className="text-sm flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(assignment.expiresAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assignment.isActive ? "default" : "secondary"}>
                          {assignment.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="text-red-600">
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Permission Overview</CardTitle>
              <CardDescription>
                System permissions and their assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6 text-muted-foreground">
                Permission matrix view would be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
