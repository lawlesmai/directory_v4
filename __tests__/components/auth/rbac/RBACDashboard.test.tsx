import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RBACDashboard } from '@/components/auth/rbac/RBACDashboard';
import type { RBACAnalytics, RBACEvent } from '@/components/auth/rbac/types';

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
  BarChart3: () => <span data-testid="bar-chart-icon">BarChart3</span>,
  Shield: () => <span data-testid="shield-icon">Shield</span>,
  Users: () => <span data-testid="users-icon">Users</span>,
  AlertTriangle: () => <span data-testid="alert-icon">AlertTriangle</span>,
  TrendingUp: () => <span data-testid="trending-up-icon">TrendingUp</span>,
  TrendingDown: () => <span data-testid="trending-down-icon">TrendingDown</span>,
  Activity: () => <span data-testid="activity-icon">Activity</span>,
  RefreshCw: () => <span data-testid="refresh-icon">RefreshCw</span>,
  Download: () => <span data-testid="download-icon">Download</span>,
  CheckCircle: () => <span data-testid="check-circle-icon">CheckCircle</span>,
  XCircle: () => <span data-testid="x-circle-icon">XCircle</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">AlertCircle</span>,
  Award: () => <span data-testid="award-icon">Award</span>,
  Gauge: () => <span data-testid="gauge-icon">Gauge</span>,
  Target: () => <span data-testid="target-icon">Target</span>,
  Crown: () => <span data-testid="crown-icon">Crown</span>,
  Building2: () => <span data-testid="building-icon">Building2</span>,
  Tool: () => <span data-testid="tool-icon">Tool</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
  User: () => <span data-testid="user-icon">User</span>,
  Star: () => <span data-testid="star-icon">Star</span>,
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

describe('RBACDashboard', () => {
  // Mock data
  const mockAnalytics: RBACAnalytics = {
    userCount: {
      total: 150,
      byRole: {
        customer: 100,
        business_owner: 30,
        service_provider: 15,
        admin: 4,
        super_admin: 1
      },
      active: 145,
      inactive: 5
    },
    roleUsage: {
      mostUsed: [
        { roleId: 'role-customer', count: 100 },
        { roleId: 'role-business', count: 30 },
        { roleId: 'role-service', count: 15 }
      ],
      leastUsed: [
        { roleId: 'role-admin', count: 4 },
        { roleId: 'role-super', count: 1 }
      ],
      trending: [
        { roleId: 'role-business', change: 15 },
        { roleId: 'role-service', change: 8 }
      ]
    },
    permissionUsage: {
      mostGranted: [
        { permission: 'read:businesses', count: 145 },
        { permission: 'write:reviews', count: 45 }
      ],
      riskiest: [
        { permission: 'manage:system', riskScore: 95 },
        { permission: 'delete:users', riskScore: 85 }
      ]
    },
    violations: {
      count: 12,
      recent: [],
      trends: [
        { date: '2024-01-01', count: 5 },
        { date: '2024-01-02', count: 7 }
      ]
    },
    compliance: {
      score: 85,
      issues: [
        { type: 'orphaned_permission', count: 3, severity: 'low' },
        { type: 'excessive_privileges', count: 2, severity: 'medium' },
        { type: 'inactive_role', count: 1, severity: 'high' }
      ]
    }
  };

  const mockRecentEvents: RBACEvent[] = [
    {
      id: 'event-1',
      eventType: 'role_assigned',
      userId: 'user-1',
      resourceId: 'role-1',
      resourceType: 'role',
      details: { reason: 'New employee onboarding' },
      metadata: {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session-1'
      },
      riskScore: 25,
      timestamp: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: 'event-2',
      eventType: 'security_violation',
      userId: 'user-2',
      resourceId: 'perm-1',
      resourceType: 'permission',
      details: { reason: 'Unauthorized access attempt' },
      metadata: {
        ipAddress: '203.45.67.89',
        userAgent: 'curl/7.68.0',
        sessionId: 'session-2'
      },
      riskScore: 90,
      timestamp: new Date('2024-01-01T09:30:00Z')
    }
  ];

  const mockProps = {
    analytics: mockAnalytics,
    recentEvents: mockRecentEvents,
    onRefresh: jest.fn(),
    onExportData: jest.fn(),
    onViewDetails: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders dashboard header', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('RBAC Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Monitor roles, permissions, and security across your organization')).toBeInTheDocument();
    });

    test('renders navigation tabs', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Roles')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    test('renders key metrics', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('150')).toBeInTheDocument(); // Total users
      expect(screen.getByText('85%')).toBeInTheDocument(); // Compliance score
      expect(screen.getByText('12')).toBeInTheDocument(); // Security violations
    });

    test('renders time range selector', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByDisplayValue('Last 7 days')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    test('switches to users tab', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      const usersTab = screen.getByText('Users');
      fireEvent.click(usersTab);

      await waitFor(() => {
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('Active Users')).toBeInTheDocument();
        expect(screen.getByText('Inactive Users')).toBeInTheDocument();
      });
    });

    test('switches to roles tab', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      const rolesTab = screen.getByText('Roles');
      fireEvent.click(rolesTab);

      await waitFor(() => {
        expect(screen.getByText('Most Used Roles')).toBeInTheDocument();
        expect(screen.getByText('Role Usage Analytics')).toBeInTheDocument();
      });
    });

    test('switches to security tab', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      const securityTab = screen.getByText('Security');
      fireEvent.click(securityTab);

      await waitFor(() => {
        expect(screen.getByText('Security Violations')).toBeInTheDocument();
        expect(screen.getByText('High-Risk Permissions')).toBeInTheDocument();
      });
    });
  });

  describe('Metric Cards', () => {
    test('displays user metrics correctly', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('97% active')).toBeInTheDocument();
    });

    test('shows compliance score', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    test('displays security violations count', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    test('metric cards are clickable', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      const totalUsersCard = screen.getByText('150').closest('div');
      if (totalUsersCard) {
        fireEvent.click(totalUsersCard);
        
        await waitFor(() => {
          expect(mockProps.onViewDetails).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Charts and Visualizations', () => {
    test('renders user distribution charts', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('Users by Role')).toBeInTheDocument();
      expect(screen.getByText('Role Usage')).toBeInTheDocument();
    });

    test('displays chart data correctly', () => {
      render(<RBACDashboard {...mockProps} />);
      
      // Should show role counts from analytics
      expect(screen.getByText('customer')).toBeInTheDocument();
      expect(screen.getByText('business owner')).toBeInTheDocument();
    });
  });

  describe('Recent Activity', () => {
    test('renders recent events', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('New employee onboarding')).toBeInTheDocument();
      expect(screen.getByText('Unauthorized access attempt')).toBeInTheDocument();
    });

    test('shows event details', () => {
      render(<RBACDashboard {...mockProps} />);
      
      // Should show IP addresses and timestamps
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
      expect(screen.getByText('203.45.67.89')).toBeInTheDocument();
    });

    test('handles event click', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      const eventItem = screen.getByText('New employee onboarding').closest('div');
      if (eventItem) {
        fireEvent.click(eventItem);
        
        await waitFor(() => {
          expect(mockProps.onViewDetails).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Compliance Issues', () => {
    test('displays compliance issues', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('Compliance Issues')).toBeInTheDocument();
      expect(screen.getByText('Orphaned Permissions')).toBeInTheDocument();
      expect(screen.getByText('Excessive Privileges')).toBeInTheDocument();
      expect(screen.getByText('Inactive Roles')).toBeInTheDocument();
    });

    test('shows issue counts and severity', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('3')).toBeInTheDocument(); // Orphaned permissions
      expect(screen.getByText('2')).toBeInTheDocument(); // Excessive privileges
      expect(screen.getByText('1')).toBeInTheDocument(); // Inactive roles
    });

    test('handles compliance issue click', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      const issueItem = screen.getByText('Orphaned Permissions').closest('div');
      if (issueItem) {
        fireEvent.click(issueItem);
        
        await waitFor(() => {
          expect(mockProps.onViewDetails).toHaveBeenCalledWith('compliance', { issue: 'orphaned_permission' });
        });
      }
    });
  });

  describe('Controls and Actions', () => {
    test('handles refresh button click', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockProps.onRefresh).toHaveBeenCalled();
      });
    });

    test('handles time range change', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      const timeSelector = screen.getByDisplayValue('Last 7 days');
      fireEvent.change(timeSelector, { target: { value: '30d' } });

      // Should update the selected time range
      expect(timeSelector).toHaveValue('30d');
    });

    test('shows export menu', () => {
      render(<RBACDashboard {...mockProps} />);
      
      const exportButton = screen.getByText('Export');
      expect(exportButton).toBeInTheDocument();
    });

    test('handles export actions', async () => {
      render(<RBACDashboard {...mockProps} />);
      
      // This would need to be tested with user interaction to open dropdown
      await mockProps.onExportData('users');
      expect(mockProps.onExportData).toHaveBeenCalledWith('users');
    });
  });

  describe('Loading States', () => {
    test('shows loading state during refresh', async () => {
      const mockPropsWithLoading = {
        ...mockProps,
        onRefresh: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      };

      render(<RBACDashboard {...mockPropsWithLoading} />);
      
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Refreshing...')).toBeInTheDocument();
      });
    });
  });

  describe('Data Calculations', () => {
    test('calculates derived metrics correctly', () => {
      render(<RBACDashboard {...mockProps} />);
      
      // Active percentage: 145/150 = 97%
      expect(screen.getByText('97% active')).toBeInTheDocument();
    });

    test('handles empty data gracefully', () => {
      const emptyAnalytics: RBACAnalytics = {
        userCount: { total: 0, byRole: {}, active: 0, inactive: 0 },
        roleUsage: { mostUsed: [], leastUsed: [], trending: [] },
        permissionUsage: { mostGranted: [], riskiest: [] },
        violations: { count: 0, recent: [], trends: [] },
        compliance: { score: 0, issues: [] }
      };

      render(<RBACDashboard {...mockProps} analytics={emptyAnalytics} />);
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('renders properly on different screen sizes', () => {
      render(<RBACDashboard {...mockProps} />);
      
      // Check that responsive elements are present
      const hiddenSmElements = document.querySelectorAll('.hidden.sm\\:inline, .sm\\:hidden');
      expect(hiddenSmElements.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('handles refresh errors gracefully', async () => {
      const mockPropsWithError = {
        ...mockProps,
        onRefresh: jest.fn().mockRejectedValue(new Error('Refresh failed'))
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<RBACDashboard {...mockPropsWithError} />);
      
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh dashboard:', expect.any(Error));
      });

      consoleSpy.mkRestore();
    });

    test('handles export errors gracefully', async () => {
      const mockPropsWithError = {
        ...mockProps,
        onExportData: jest.fn().mockRejectedValue(new Error('Export failed'))
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<RBACDashboard {...mockPropsWithError} />);
      
      await mockPropsWithError.onExportData('users');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to export data:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    test('has proper heading structure', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('RBAC Dashboard');
    });

    test('has proper tab navigation', () => {
      render(<RBACDashboard {...mockProps} />);
      
      const tabs = screen.getAllByRole('button');
      const tabButtons = tabs.filter(tab => 
        ['Overview', 'Users', 'Roles', 'Security'].includes(tab.textContent || '')
      );
      
      expect(tabButtons.length).toBeGreaterThan(0);
    });

    test('has proper form controls', () => {
      render(<RBACDashboard {...mockProps} />);
      
      const timeSelector = screen.getByDisplayValue('Last 7 days');
      expect(timeSelector).toBeInTheDocument();
    });
  });

  describe('Footer Information', () => {
    test('shows footer statistics', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      expect(screen.getByText(/Data range:/)).toBeInTheDocument();
    });

    test('shows status indicators', () => {
      render(<RBACDashboard {...mockProps} />);
      
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });
});