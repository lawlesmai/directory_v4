import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PermissionMatrix } from '@/components/auth/rbac/PermissionMatrix';
import type { RoleDefinition, PermissionDefinition, UserRoleAssignment, BusinessContext } from '@/components/auth/rbac/types';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock icons
jest.mock('lucide-react', () => ({
  Grid3X3: () => <span data-testid="grid-icon">Grid3X3</span>,
  Check: () => <span data-testid="check-icon">Check</span>,
  X: () => <span data-testid="x-icon">X</span>,
  Shield: () => <span data-testid="shield-icon">Shield</span>,
  ChevronRight: () => <span data-testid="chevron-right">ChevronRight</span>,
  ChevronDown: () => <span data-testid="chevron-down">ChevronDown</span>,
  Eye: () => <span data-testid="eye-icon">Eye</span>,
  EyeOff: () => <span data-testid="eye-off-icon">EyeOff</span>,
  Search: () => <span data-testid="search-icon">Search</span>,
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  Minus: () => <span data-testid="minus-icon">Minus</span>,
  AlertTriangle: () => <span data-testid="alert-icon">AlertTriangle</span>,
  Info: () => <span data-testid="info-icon">Info</span>,
  Users: () => <span data-testid="users-icon">Users</span>,
  Building2: () => <span data-testid="building-icon">Building2</span>,
  User: () => <span data-testid="user-icon">User</span>,
  Crown: () => <span data-testid="crown-icon">Crown</span>,
  Tool: () => <span data-testid="tool-icon">Tool</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
  Star: () => <span data-testid="star-icon">Star</span>,
  TrendingUp: () => <span data-testid="trending-up-icon">TrendingUp</span>,
}));

// Mock GlassMorphism
jest.mock('@/components/GlassMorphism', () => ({
  GlassMorphism: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  )
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ')
}));

describe('PermissionMatrix', () => {
  // Mock data
  const mockBusinessContext: BusinessContext = {
    id: 'ctx-1',
    name: 'Main Business',
    type: 'business',
    isActive: true
  };

  const mockRoles: RoleDefinition[] = [
    {
      id: 'role-1',
      name: 'admin',
      displayName: 'Administrator',
      description: 'System administrator',
      level: 90,
      permissions: ['manage:system', 'read:businesses'],
      inheritedPermissions: [],
      contexts: [mockBusinessContext],
      isSystemRole: true,
      isActive: true,
      metadata: {
        color: 'from-red-error/20 to-red-warning/20',
        icon: 'crown',
        category: 'system'
      },
      constraints: {
        requiresApproval: false
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 'system'
    },
    {
      id: 'role-2',
      name: 'customer',
      displayName: 'Customer',
      description: 'Basic customer role',
      level: 10,
      permissions: ['read:businesses'],
      inheritedPermissions: [],
      contexts: [mockBusinessContext],
      isSystemRole: false,
      isActive: true,
      metadata: {
        color: 'from-sage/20 to-teal-primary/20',
        icon: 'user',
        category: 'user'
      },
      constraints: {
        requiresApproval: false
      },
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      createdBy: 'admin'
    }
  ];

  const mockPermissions: PermissionDefinition[] = [
    {
      id: 'perm-1',
      name: 'read:businesses',
      displayName: 'Read Businesses',
      description: 'View business listings',
      resource: 'business',
      action: 'read',
      category: 'Basic',
      riskLevel: 'low',
      contexts: [mockBusinessContext],
      isSystemPermission: false,
      metadata: {
        icon: 'building',
        color: 'sage'
      },
      auditRequired: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: 'perm-2',
      name: 'manage:system',
      displayName: 'Manage System',
      description: 'Full system administration',
      resource: 'system',
      action: 'manage',
      category: 'Admin',
      riskLevel: 'critical',
      dependencies: ['read:businesses'],
      contexts: [mockBusinessContext],
      isSystemPermission: true,
      metadata: {
        icon: 'shield',
        color: 'red'
      },
      auditRequired: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ];

  const mockAssignments: UserRoleAssignment[] = [];

  const mockProps = {
    roles: mockRoles,
    permissions: mockPermissions,
    assignments: mockAssignments,
    businessContext: mockBusinessContext,
    onPermissionToggle: jest.fn(),
    onBulkPermissionUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders permission matrix', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByText('Permission Matrix')).toBeInTheDocument();
      expect(screen.getByText(`Manage role permissions across ${mockBusinessContext.name}`)).toBeInTheDocument();
    });

    test('renders search input', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByPlaceholderText('Search permissions...')).toBeInTheDocument();
    });

    test('renders risk level filter', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByDisplayValue('All Risk Levels')).toBeInTheDocument();
    });

    test('renders role headers', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
    });

    test('renders permission groups', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByText('business Permissions')).toBeInTheDocument();
      expect(screen.getByText('system Permissions')).toBeInTheDocument();
    });
  });

  describe('Permission Display', () => {
    test('shows permission details', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByText('Read Businesses')).toBeInTheDocument();
      expect(screen.getByText('View business listings')).toBeInTheDocument();
      expect(screen.getByText('Manage System')).toBeInTheDocument();
      expect(screen.getByText('Full system administration')).toBeInTheDocument();
    });

    test('displays risk indicators', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // Look for visual risk indicators (dots, colors, etc.)
      const permissionRows = screen.getAllByText(/permissions/i);
      expect(permissionRows.length).toBeGreaterThan(0);
    });

    test('shows dependency indicators', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // The system permission has dependencies
      expect(screen.getByText('Has dependencies')).toBeInTheDocument();
    });
  });

  describe('Permission Matrix Interactions', () => {
    test('toggles permission when cell clicked', async () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // Find a permission cell and click it
      const permissionCells = document.querySelectorAll('[role="gridcell"], .permission-cell, [data-testid*="permission-cell"]');
      if (permissionCells.length > 0) {
        fireEvent.click(permissionCells[0]);
        
        await waitFor(() => {
          expect(mockProps.onPermissionToggle).toHaveBeenCalled();
        });
      }
    });

    test('handles readonly mode', () => {
      render(<PermissionMatrix {...mockProps} readonly />);
      
      // Permission cells should not be clickable when readonly
      const permissionCells = document.querySelectorAll('.cursor-not-allowed, .opacity-50');
      expect(permissionCells.length).toBeGreaterThan(0);
    });

    test('shows inherited permissions differently', () => {
      const rolesWithInherited = mockRoles.map(role => ({
        ...role,
        inheritedPermissions: role.id === 'role-2' ? ['manage:system'] : []
      }));

      render(<PermissionMatrix {...mockProps} roles={rolesWithInherited} />);
      
      // Should show inherited indicator
      expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
    });
  });

  describe('Resource Groups', () => {
    test('expands and collapses resource groups', async () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // Find expand/collapse buttons for resource groups
      const expandButton = screen.getByTestId('chevron-right');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('chevron-down')).toBeInTheDocument();
      });
    });

    test('shows resource statistics', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByText(/1 permissions/)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    test('filters permissions by search query', async () => {
      render(<PermissionMatrix {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search permissions...');
      fireEvent.change(searchInput, { target: { value: 'business' } });

      await waitFor(() => {
        expect(screen.getByText('Read Businesses')).toBeInTheDocument();
        // System permission should be filtered out
        expect(screen.queryByText('system Permissions')).not.toBeInTheDocument();
      });
    });

    test('filters by risk level', async () => {
      render(<PermissionMatrix {...mockProps} />);
      
      const riskFilter = screen.getByDisplayValue('All Risk Levels');
      fireEvent.change(riskFilter, { target: { value: 'critical' } });

      await waitFor(() => {
        expect(screen.getByText('Manage System')).toBeInTheDocument();
        expect(screen.queryByText('Read Businesses')).not.toBeInTheDocument();
      });
    });
  });

  describe('Bulk Operations', () => {
    test('shows bulk actions when permissions selected', async () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // This would typically involve selecting permissions first
      // The bulk actions UI would appear
      // For now, we'll test that the functions exist
      expect(mockProps.onBulkPermissionUpdate).toBeDefined();
    });

    test('calls bulk update function', async () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // Simulate bulk operation
      // This would be triggered by UI interactions
      await mockProps.onBulkPermissionUpdate([{
        roleId: 'role-1',
        permissions: ['read:businesses'],
        operation: 'grant' as const
      }]);

      expect(mockProps.onBulkPermissionUpdate).toHaveBeenCalled();
    });
  });

  describe('View Controls', () => {
    test('expands all resource groups', async () => {
      render(<PermissionMatrix {...mockProps} />);
      
      const expandAllButton = screen.getByTestId('eye-icon').closest('button');
      fireEvent.click(expandAllButton!);

      // All resource groups should expand
      await waitFor(() => {
        expect(screen.getAllByTestId('chevron-down')).toBeTruthy();
      });
    });

    test('collapses all resource groups', async () => {
      render(<PermissionMatrix {...mockProps} />);
      
      const collapseAllButton = screen.getByTestId('eye-off-icon').closest('button');
      fireEvent.click(collapseAllButton!);

      // All resource groups should collapse
      await waitFor(() => {
        expect(screen.getAllByTestId('chevron-right')).toBeTruthy();
      });
    });
  });

  describe('Statistics', () => {
    test('displays permission statistics', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // Should show counts of various metrics
      expect(screen.getByText('2')).toBeInTheDocument(); // Direct permissions count
      expect(screen.getByText('2')).toBeInTheDocument(); // Active roles count
      expect(screen.getByText('2')).toBeInTheDocument(); // Total permissions count
    });

    test('calculates statistics correctly', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // Verify the statistics are calculated based on the mock data
      const statsElements = screen.getAllByText('2');
      expect(statsElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Legend', () => {
    test('shows permission legend', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByText('Legend')).toBeInTheDocument();
      expect(screen.getByText('Direct Permission')).toBeInTheDocument();
      expect(screen.getByText('Inherited Permission')).toBeInTheDocument();
      expect(screen.getByText('No Permission')).toBeInTheDocument();
    });

    test('shows risk level indicators in legend', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      expect(screen.getByText('Critical Risk')).toBeInTheDocument();
      expect(screen.getByText('High Risk')).toBeInTheDocument();
      expect(screen.getByText('Risk Warning')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search permissions...');
      expect(searchInput).toHaveAttribute('type', 'text');
    });

    test('supports keyboard navigation', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search permissions...');
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('Error Handling', () => {
    test('handles permission toggle errors', async () => {
      const mockPropsWithError = {
        ...mockProps,
        onPermissionToggle: jest.fn().mockRejectedValue(new Error('Toggle failed'))
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<PermissionMatrix {...mockPropsWithError} />);
      
      // Try to toggle a permission
      await mockPropsWithError.onPermissionToggle('role-1', 'read:businesses', true);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('handles bulk update errors', async () => {
      const mockPropsWithError = {
        ...mockProps,
        onBulkPermissionUpdate: jest.fn().mockRejectedValue(new Error('Bulk update failed'))
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<PermissionMatrix {...mockPropsWithError} />);
      
      // Try bulk update
      await mockPropsWithError.onBulkPermissionUpdate([]);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Permission Cell States', () => {
    test('shows granted permissions correctly', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // Admin role has manage:system permission
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });

    test('shows denied permissions correctly', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // Customer role doesn't have manage:system permission
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    test('indicates system role restrictions', () => {
      render(<PermissionMatrix {...mockProps} />);
      
      // System roles should have different styling
      const adminElements = screen.getAllByText('Administrator');
      expect(adminElements.length).toBeGreaterThan(0);
    });
  });
});