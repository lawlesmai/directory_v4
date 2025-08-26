import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { RoleHierarchyManager } from '@/components/auth/rbac/RoleHierarchyManager';
import type { RoleDefinition, BusinessContext } from '@/components/auth/rbac/types';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  Reorder: {
    Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Item: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  }
}));

// Mock icons
jest.mock('lucide-react', () => ({
  Shield: () => <span data-testid="shield-icon">Shield</span>,
  ChevronRight: () => <span data-testid="chevron-right-icon">ChevronRight</span>,
  ChevronDown: () => <span data-testid="chevron-down-icon">ChevronDown</span>,
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  Edit3: () => <span data-testid="edit-icon">Edit3</span>,
  Trash2: () => <span data-testid="trash-icon">Trash2</span>,
  Users: () => <span data-testid="users-icon">Users</span>,
  Settings: () => <span data-testid="settings-icon">Settings</span>,
  Eye: () => <span data-testid="eye-icon">Eye</span>,
  EyeOff: () => <span data-testid="eye-off-icon">EyeOff</span>,
  Save: () => <span data-testid="save-icon">Save</span>,
  X: () => <span data-testid="x-icon">X</span>,
  Search: () => <span data-testid="search-icon">Search</span>,
  Crown: () => <span data-testid="crown-icon">Crown</span>,
  User: () => <span data-testid="user-icon">User</span>,
  Building2: () => <span data-testid="building-icon">Building2</span>,
  Tool: () => <span data-testid="tool-icon">Tool</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
  Grip: () => <span data-testid="grip-icon">Grip</span>,
  Move: () => <span data-testid="move-icon">Move</span>,
  AlertTriangle: () => <span data-testid="alert-icon">AlertTriangle</span>,
}));

// Mock GlassMorphism component
jest.mock('@/components/GlassMorphism', () => ({
  GlassMorphism: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  )
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ')
}));

describe('RoleHierarchyManager', () => {
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
      permissions: ['manage:system', 'manage:users'],
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
      parentRole: 'role-1',
      permissions: ['read:businesses'],
      inheritedPermissions: ['manage:system'],
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

  // Mock functions
  const mockProps = {
    roles: mockRoles,
    onRoleUpdate: jest.fn(),
    onRoleCreate: jest.fn(),
    onRoleDelete: jest.fn(),
    onHierarchyChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders role hierarchy manager', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      expect(screen.getByText('Role Hierarchy')).toBeInTheDocument();
      expect(screen.getByText('Manage roles and their inheritance relationships')).toBeInTheDocument();
    });

    test('renders role nodes', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('System administrator')).toBeInTheDocument();
      expect(screen.getByText('Basic customer role')).toBeInTheDocument();
    });

    test('shows role statistics', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      expect(screen.getByText('2 total roles')).toBeInTheDocument();
      expect(screen.getByText('2 active')).toBeInTheDocument();
      expect(screen.getByText('1 system roles')).toBeInTheDocument();
    });

    test('renders search input', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search roles...');
      expect(searchInput).toBeInTheDocument();
    });

    test('renders new role button when not readonly', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      expect(screen.getByText('New Role')).toBeInTheDocument();
    });

    test('does not render new role button when readonly', () => {
      render(<RoleHierarchyManager {...mockProps} readonly />);
      
      expect(screen.queryByText('New Role')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    test('filters roles by search query', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search roles...');
      fireEvent.change(searchInput, { target: { value: 'admin' } });

      await waitFor(() => {
        expect(screen.getByText('Administrator')).toBeInTheDocument();
        expect(screen.queryByText('Customer')).not.toBeInTheDocument();
      });
    });

    test('shows no results message when no roles match search', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search roles...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.queryByText('Administrator')).not.toBeInTheDocument();
        expect(screen.queryByText('Customer')).not.toBeInTheDocument();
      });
    });
  });

  describe('Role Hierarchy', () => {
    test('shows hierarchy indicators', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      // Look for expand/collapse buttons
      expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
    });

    test('expands and collapses role nodes', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const expandButton = screen.getByTestId('chevron-right-icon').closest('button');
      expect(expandButton).toBeInTheDocument();

      fireEvent.click(expandButton!);
      
      await waitFor(() => {
        expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
      });
    });
  });

  describe('Role Actions', () => {
    test('opens create form when new role button clicked', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const newRoleButton = screen.getByText('New Role');
      fireEvent.click(newRoleButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Role')).toBeInTheDocument();
      });
    });

    test('shows edit form when edit button clicked', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const editButton = screen.getByTestId('edit-icon').closest('button');
      fireEvent.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText('Edit Role')).toBeInTheDocument();
      });
    });

    test('does not show edit/delete buttons when readonly', () => {
      render(<RoleHierarchyManager {...mockProps} readonly />);
      
      expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('trash-icon')).not.toBeInTheDocument();
    });
  });

  describe('Role Creation/Editing', () => {
    test('validates required fields in role form', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const newRoleButton = screen.getByText('New Role');
      fireEvent.click(newRoleButton);

      await waitFor(() => {
        const saveButton = screen.getByText('Create Role');
        fireEvent.click(saveButton);
        
        // Should show validation errors
        expect(screen.getByText('Role name is required')).toBeInTheDocument();
        expect(screen.getByText('Display name is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
      });
    });

    test('calls onRoleCreate when form is valid', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const newRoleButton = screen.getByText('New Role');
      fireEvent.click(newRoleButton);

      await waitFor(() => {
        // Fill in form fields
        fireEvent.change(screen.getByPlaceholderText('e.g., content_manager'), {
          target: { value: 'test_role' }
        });
        fireEvent.change(screen.getByPlaceholderText('e.g., Content Manager'), {
          target: { value: 'Test Role' }
        });
        fireEvent.change(screen.getByPlaceholderText('Describe what this role does...'), {
          target: { value: 'Test role description' }
        });

        const saveButton = screen.getByText('Create Role');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockProps.onRoleCreate).toHaveBeenCalled();
      });
    });

    test('calls onRoleUpdate when editing existing role', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const editButton = screen.getByTestId('edit-icon').closest('button');
      fireEvent.click(editButton!);

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockProps.onRoleUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Role Deletion', () => {
    test('shows confirmation dialog when deleting role', async () => {
      // Mock window.confirm
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<RoleHierarchyManager {...mockProps} />);
      
      const deleteButton = screen.getByTestId('trash-icon').closest('button');
      fireEvent.click(deleteButton!);

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure you want to delete the role "Customer"')
      );
      
      await waitFor(() => {
        expect(mockProps.onRoleDelete).toHaveBeenCalledWith('role-2');
      });

      confirmSpy.mockRestore();
    });

    test('prevents deletion of system roles', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      
      render(<RoleHierarchyManager {...mockProps} />);
      
      // Try to delete the admin role (system role)
      const adminRole = screen.getByText('Administrator').closest('.group');
      const deleteButton = adminRole?.querySelector('[data-testid="trash-icon"]')?.closest('button');
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(alertSpy).toHaveBeenCalledWith('Cannot delete system roles');
      }

      alertSpy.mockRestore();
    });
  });

  describe('Drag and Drop', () => {
    test('enables drag and drop when not readonly', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const roleNode = screen.getByText('Customer').closest('[draggable]');
      expect(roleNode).toHaveAttribute('draggable', 'true');
    });

    test('disables drag and drop when readonly', () => {
      render(<RoleHierarchyManager {...mockProps} readonly />);
      
      const roleNode = screen.getByText('Customer').closest('[draggable]');
      expect(roleNode).toHaveAttribute('draggable', 'false');
    });

    test('calls onHierarchyChange when role is dropped', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const roleNode = screen.getByText('Customer').closest('[draggable]')!;
      
      // Simulate drag and drop
      fireEvent.dragStart(roleNode, {
        dataTransfer: {
          effectAllowed: 'move',
          setData: jest.fn()
        }
      });

      const dropTarget = screen.getByText('Administrator').closest('div')!;
      fireEvent.drop(dropTarget, {
        dataTransfer: {
          getData: () => 'role-2'
        }
      });

      await waitFor(() => {
        expect(mockProps.onHierarchyChange).toHaveBeenCalled();
      });
    });
  });

  describe('Expand/Collapse All', () => {
    test('expands all nodes when expand all button clicked', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const expandAllButton = screen.getByTestId('eye-icon').closest('button');
      fireEvent.click(expandAllButton!);

      // All roles should now show as expanded
      await waitFor(() => {
        expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
      });
    });

    test('collapses all nodes when collapse all button clicked', async () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      // First expand all
      const expandAllButton = screen.getByTestId('eye-icon').closest('button');
      fireEvent.click(expandAllButton!);

      await waitFor(() => {
        expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
      });

      // Then collapse all
      const collapseAllButton = screen.getByTestId('eye-off-icon').closest('button');
      fireEvent.click(collapseAllButton!);

      await waitFor(() => {
        expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels for interactive elements', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search roles...');
      expect(searchInput).toBeInTheDocument();
      
      const newRoleButton = screen.getByText('New Role');
      expect(newRoleButton).toBeInTheDocument();
    });

    test('supports keyboard navigation', () => {
      render(<RoleHierarchyManager {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search roles...');
      expect(searchInput).toHaveAttribute('type', 'text');
      
      // Should be focusable
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('Error Handling', () => {
    test('handles role creation errors gracefully', async () => {
      const mockPropsWithError = {
        ...mockProps,
        onRoleCreate: jest.fn().mockRejectedValue(new Error('Creation failed'))
      };
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<RoleHierarchyManager {...mockPropsWithError} />);
      
      const newRoleButton = screen.getByText('New Role');
      fireEvent.click(newRoleButton);

      await waitFor(() => {
        // Fill in valid form data
        fireEvent.change(screen.getByPlaceholderText('e.g., content_manager'), {
          target: { value: 'test_role' }
        });
        fireEvent.change(screen.getByPlaceholderText('e.g., Content Manager'), {
          target: { value: 'Test Role' }
        });
        fireEvent.change(screen.getByPlaceholderText('Describe what this role does...'), {
          target: { value: 'Test description' }
        });

        const saveButton = screen.getByText('Create Role');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save role:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});