/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock Next.js router
const mockPush = jest.fn();
const mockUseRouter = {
  push: mockPush,
  pathname: '/admin',
  query: {},
  asPath: '/admin'
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter,
  usePathname: () => '/admin'
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>
  },
  AnimatePresence: ({ children }: any) => children
}));

// Import components after mocks
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { AdminDashboardLayout } from '@/components/admin/AdminDashboardLayout';
import { AdminUserManagement } from '@/components/admin/AdminUserManagement';
import { SessionManagement } from '@/components/admin/SessionManagement';
import { SecuritySettings } from '@/components/admin/SecuritySettings';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';

describe('Admin Portal Foundation & Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AdminLoginForm Component', () => {
    it('renders admin login form with security indicators', () => {
      render(<AdminLoginForm />);
      
      expect(screen.getByText('Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Secure administrative access to Lawless Directory')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('admin@lawlessdirectory.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your admin password')).toBeInTheDocument();
      expect(screen.getByText('SSL Encrypted')).toBeInTheDocument();
      expect(screen.getByText('Session Timeout: 30min')).toBeInTheDocument();
      expect(screen.getByText('MFA Required')).toBeInTheDocument();
    });

    it('displays connection security information', () => {
      render(<AdminLoginForm />);
      
      expect(screen.getByText('Connection Secure')).toBeInTheDocument();
      expect(screen.getByText(/IP: 192\.168\.1\.100/)).toBeInTheDocument();
      expect(screen.getByText('Failed attempts: 0')).toBeInTheDocument();
    });

    it('validates email and password fields', async () => {
      const user = userEvent.setup();
      render(<AdminLoginForm />);
      
      const submitButton = screen.getByRole('button', { name: /sign in to admin portal/i });
      
      // Try to submit empty form
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });
    });

    it('shows password strength requirements', async () => {
      const user = userEvent.setup();
      render(<AdminLoginForm />);
      
      const passwordInput = screen.getByPlaceholderText('Enter your admin password');
      await user.type(passwordInput, 'weak');
      
      const submitButton = screen.getByRole('button', { name: /sign in to admin portal/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      render(<AdminLoginForm />);
      
      const passwordInput = screen.getByPlaceholderText('Enter your admin password');
      const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button
      
      expect(passwordInput).toHaveAttribute('type', 'password');
      
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('handles security options correctly', async () => {
      const user = userEvent.setup();
      render(<AdminLoginForm />);
      
      const rememberDeviceCheckbox = screen.getByLabelText('Remember this device for 7 days');
      const ipWhitelistCheckbox = screen.getByLabelText('Add IP to whitelist');
      
      expect(rememberDeviceCheckbox).not.toBeChecked();
      expect(ipWhitelistCheckbox).not.toBeChecked();
      
      await user.click(rememberDeviceCheckbox);
      await user.click(ipWhitelistCheckbox);
      
      expect(rememberDeviceCheckbox).toBeChecked();
      expect(ipWhitelistCheckbox).toBeChecked();
    });

    it('progresses to MFA step with valid credentials', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = jest.fn();
      
      render(<AdminLoginForm onSuccess={mockOnSuccess} />);
      
      const emailInput = screen.getByPlaceholderText('admin@lawlessdirectory.com');
      const passwordInput = screen.getByPlaceholderText('Enter your admin password');
      const submitButton = screen.getByRole('button', { name: /sign in to admin portal/i });
      
      await user.type(emailInput, 'admin@lawlessdirectory.com');
      await user.type(passwordInput, 'AdminPass123!');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      });
    });

    it('displays error for invalid credentials', async () => {
      const user = userEvent.setup();
      const mockOnError = jest.fn();
      
      render(<AdminLoginForm onError={mockOnError} />);
      
      const emailInput = screen.getByPlaceholderText('admin@lawlessdirectory.com');
      const passwordInput = screen.getByPlaceholderText('Enter your admin password');
      const submitButton = screen.getByRole('button', { name: /sign in to admin portal/i });
      
      await user.type(emailInput, 'wrong@email.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Invalid admin credentials. Please check your email and password.')).toBeInTheDocument();
      });
    });

    it('shows loading state during authentication', async () => {
      const user = userEvent.setup();
      render(<AdminLoginForm />);
      
      const emailInput = screen.getByPlaceholderText('admin@lawlessdirectory.com');
      const passwordInput = screen.getByPlaceholderText('Enter your admin password');
      const submitButton = screen.getByRole('button', { name: /sign in to admin portal/i });
      
      await user.type(emailInput, 'admin@lawlessdirectory.com');
      await user.type(passwordInput, 'AdminPass123!');
      await user.click(submitButton);
      
      expect(screen.getByText('Authenticating...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('AdminDashboardLayout Component', () => {
    const mockUser = {
      id: 'admin-1',
      email: 'admin@lawlessdirectory.com',
      role: 'super_admin' as const,
      permissions: ['read:all', 'write:all', 'admin:all'],
      name: 'System Administrator'
    };

    it('renders admin dashboard layout with navigation', () => {
      render(
        <AdminDashboardLayout user={mockUser}>
          <div>Dashboard Content</div>
        </AdminDashboardLayout>
      );
      
      expect(screen.getByText('Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });

    it('displays user information in header', () => {
      render(
        <AdminDashboardLayout user={mockUser}>
          <div>Content</div>
        </AdminDashboardLayout>
      );
      
      expect(screen.getByText('System Administrator')).toBeInTheDocument();
      expect(screen.getByText('Super admin')).toBeInTheDocument();
    });

    it('shows notifications indicator', () => {
      render(
        <AdminDashboardLayout user={mockUser}>
          <div>Content</div>
        </AdminDashboardLayout>
      );
      
      const notificationButton = screen.getByRole('button', { name: '' }); // Bell icon
      expect(notificationButton).toBeInTheDocument();
    });

    it('renders quick stats in sidebar', () => {
      render(
        <AdminDashboardLayout user={mockUser}>
          <div>Content</div>
        </AdminDashboardLayout>
      );
      
      expect(screen.getByText('Quick Stats')).toBeInTheDocument();
      expect(screen.getByText('Active Users')).toBeInTheDocument();
      expect(screen.getByText('System Health')).toBeInTheDocument();
    });

    it('handles mobile menu toggle', async () => {
      const user = userEvent.setup();
      
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      render(
        <AdminDashboardLayout user={mockUser}>
          <div>Content</div>
        </AdminDashboardLayout>
      );
      
      const menuToggle = screen.getByRole('button', { name: '' }); // Menu icon
      await user.click(menuToggle);
      
      // Menu should be visible
      expect(screen.getByText('Navigation')).toBeInTheDocument();
    });
  });

  describe('AdminUserManagement Component', () => {
    it('renders user management interface', () => {
      render(<AdminUserManagement />);
      
      expect(screen.getByText('Admin User Management')).toBeInTheDocument();
      expect(screen.getByText('Manage administrator accounts and permissions')).toBeInTheDocument();
      expect(screen.getByText('Add Admin User')).toBeInTheDocument();
    });

    it('displays user statistics', () => {
      render(<AdminUserManagement />);
      
      expect(screen.getByText('Total Admins')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Suspended')).toBeInTheDocument();
      expect(screen.getByText('MFA Enabled')).toBeInTheDocument();
    });

    it('shows admin user cards with details', () => {
      render(<AdminUserManagement />);
      
      expect(screen.getByText('System Administrator')).toBeInTheDocument();
      expect(screen.getByText('admin@lawlessdirectory.com')).toBeInTheDocument();
      expect(screen.getByText('Super admin')).toBeInTheDocument();
    });

    it('filters users by search term', async () => {
      const user = userEvent.setup();
      render(<AdminUserManagement />);
      
      const searchInput = screen.getByPlaceholderText('Search by name, email, or role...');
      await user.type(searchInput, 'support');
      
      // Should show support admin but not others
      expect(screen.getByText('Support Lead')).toBeInTheDocument();
      expect(screen.queryByText('System Administrator')).not.toBeInTheDocument();
    });

    it('filters users by role', async () => {
      const user = userEvent.setup();
      render(<AdminUserManagement />);
      
      const roleFilter = screen.getByDisplayValue('All Roles');
      await user.selectOptions(roleFilter, 'super_admin');
      
      expect(screen.getByText('System Administrator')).toBeInTheDocument();
      expect(screen.queryByText('Support Lead')).not.toBeInTheDocument();
    });

    it('filters users by status', async () => {
      const user = userEvent.setup();
      render(<AdminUserManagement />);
      
      const statusFilter = screen.getByDisplayValue('All Status');
      await user.selectOptions(statusFilter, 'suspended');
      
      expect(screen.getByText('Content Moderator')).toBeInTheDocument();
      expect(screen.queryByText('System Administrator')).not.toBeInTheDocument();
    });
  });

  describe('SessionManagement Component', () => {
    it('renders session management interface', () => {
      render(<SessionManagement />);
      
      expect(screen.getByText('Session Management')).toBeInTheDocument();
      expect(screen.getByText('Monitor and manage active admin sessions')).toBeInTheDocument();
    });

    it('displays session statistics', () => {
      render(<SessionManagement />);
      
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      expect(screen.getByText('Total Sessions')).toBeInTheDocument();
      expect(screen.getByText('High Risk')).toBeInTheDocument();
      expect(screen.getByText('Trusted Devices')).toBeInTheDocument();
    });

    it('shows session cards with details', () => {
      render(<SessionManagement />);
      
      expect(screen.getByText('admin@lawlessdirectory.com')).toBeInTheDocument();
      expect(screen.getByText('Super admin')).toBeInTheDocument();
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    });

    it('filters sessions by search term', async () => {
      const user = userEvent.setup();
      render(<SessionManagement />);
      
      const searchInput = screen.getByPlaceholderText('Search by email, IP, or location...');
      await user.type(searchInput, 'support');
      
      expect(screen.getByText('support@lawlessdirectory.com')).toBeInTheDocument();
    });

    it('terminates sessions correctly', async () => {
      const user = userEvent.setup();
      render(<SessionManagement />);
      
      // Find and click terminate button for active session
      const terminateButtons = screen.getAllByTitle('Terminate Session');
      await user.click(terminateButtons[0]);
      
      await waitFor(() => {
        // Session should be marked as inactive
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });
  });

  describe('SecuritySettings Component', () => {
    it('renders security settings interface', () => {
      render(<SecuritySettings />);
      
      expect(screen.getByText('Security Settings')).toBeInTheDocument();
      expect(screen.getByText('Configure admin portal security policies and IP whitelisting')).toBeInTheDocument();
    });

    it('displays authentication settings', () => {
      render(<SecuritySettings />);
      
      expect(screen.getByText('Authentication Settings')).toBeInTheDocument();
      expect(screen.getByText('Require MFA')).toBeInTheDocument();
      expect(screen.getByText('Session Timeout (minutes)')).toBeInTheDocument();
    });

    it('shows IP whitelist management', () => {
      render(<SecuritySettings />);
      
      expect(screen.getByText('IP Whitelist')).toBeInTheDocument();
      expect(screen.getByText('Main Office - San Francisco')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    });

    it('toggles MFA requirement', async () => {
      const user = userEvent.setup();
      render(<SecuritySettings />);
      
      const mfaCheckbox = screen.getByLabelText('Mandatory two-factor authentication');
      expect(mfaCheckbox).toBeChecked();
      
      await user.click(mfaCheckbox);
      expect(mfaCheckbox).not.toBeChecked();
    });

    it('adds new IP to whitelist', async () => {
      const user = userEvent.setup();
      render(<SecuritySettings />);
      
      const addIPButton = screen.getByText('Add IP');
      await user.click(addIPButton);
      
      expect(screen.getByText('Add IP to Whitelist')).toBeInTheDocument();
      
      const ipInput = screen.getByPlaceholderText('192.168.1.100');
      const descInput = screen.getByPlaceholderText('Main office, VPN endpoint, etc.');
      
      await user.type(ipInput, '10.0.0.1');
      await user.type(descInput, 'Test IP');
      
      const submitButton = screen.getByRole('button', { name: 'Add IP' });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
      });
    });

    it('shows save changes button when settings modified', async () => {
      const user = userEvent.setup();
      render(<SecuritySettings />);
      
      const sessionTimeoutSelect = screen.getByDisplayValue('30 minutes');
      await user.selectOptions(sessionTimeoutSelect, '60');
      
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });
  });

  describe('AuditLogViewer Component', () => {
    it('renders audit log viewer interface', () => {
      render(<AuditLogViewer />);
      
      expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument();
      expect(screen.getByText('Real-time monitoring of admin activities and system events')).toBeInTheDocument();
    });

    it('displays audit log statistics', () => {
      render(<AuditLogViewer />);
      
      expect(screen.getByText('Total Events')).toBeInTheDocument();
      expect(screen.getByText('Failed Actions')).toBeInTheDocument();
      expect(screen.getByText('High Risk Events')).toBeInTheDocument();
    });

    it('shows audit log entries', () => {
      render(<AuditLogViewer />);
      
      expect(screen.getByText('user suspended')).toBeInTheDocument();
      expect(screen.getByText('business verified')).toBeInTheDocument();
      expect(screen.getByText('admin@lawlessdirectory.com')).toBeInTheDocument();
    });

    it('filters logs by search term', async () => {
      const user = userEvent.setup();
      render(<AuditLogViewer />);
      
      const searchInput = screen.getByPlaceholderText('Search logs by admin, action, or IP address...');
      await user.type(searchInput, 'suspended');
      
      expect(screen.getByText('user suspended')).toBeInTheDocument();
      expect(screen.queryByText('business verified')).not.toBeInTheDocument();
    });

    it('expands log entries to show details', async () => {
      const user = userEvent.setup();
      render(<AuditLogViewer />);
      
      const logEntry = screen.getByText('user suspended').closest('div');
      if (logEntry) {
        await user.click(logEntry);
        
        await waitFor(() => {
          expect(screen.getByText('Details')).toBeInTheDocument();
        });
      }
    });

    it('shows live indicator when real-time is enabled', () => {
      render(<AuditLogViewer realTime />);
      
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('opens advanced filter modal', async () => {
      const user = userEvent.setup();
      render(<AuditLogViewer />);
      
      const filterButton = screen.getByText('Advanced Filters');
      await user.click(filterButton);
      
      expect(screen.getByText('Filter Audit Logs')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('maintains consistent design system across components', () => {
      const { container: loginContainer } = render(<AdminLoginForm />);
      const { container: dashboardContainer } = render(
        <AdminDashboardLayout>
          <AdminUserManagement />
        </AdminDashboardLayout>
      );
      
      // Check for glassmorphism classes
      expect(loginContainer.querySelector('.glassmorphism')).toBeInTheDocument();
      expect(dashboardContainer.querySelector('.glassmorphism')).toBeInTheDocument();
      
      // Check for consistent color scheme
      expect(loginContainer.querySelector('.text-cream')).toBeInTheDocument();
      expect(dashboardContainer.querySelector('.text-cream')).toBeInTheDocument();
    });

    it('handles role-based access control properly', () => {
      const superAdminUser = {
        id: 'admin-1',
        email: 'admin@lawlessdirectory.com',
        role: 'super_admin' as const,
        permissions: ['read:all', 'write:all', 'admin:all'],
        name: 'Super Admin'
      };

      const supportAdminUser = {
        id: 'admin-2',
        email: 'support@lawlessdirectory.com',
        role: 'support_admin' as const,
        permissions: ['read:users', 'write:support'],
        name: 'Support Admin'
      };

      const { rerender } = render(
        <AdminDashboardLayout user={superAdminUser}>
          <div>Content</div>
        </AdminDashboardLayout>
      );

      // Super admin should see all navigation items
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Security Monitoring')).toBeInTheDocument();

      rerender(
        <AdminDashboardLayout user={supportAdminUser}>
          <div>Content</div>
        </AdminDashboardLayout>
      );

      // Support admin should have limited access
      expect(screen.getByText('Customer Support')).toBeInTheDocument();
    });

    it('maintains session security throughout navigation', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = jest.fn();
      
      render(<AdminLoginForm onSuccess={mockOnSuccess} />);
      
      // Complete login flow
      const emailInput = screen.getByPlaceholderText('admin@lawlessdirectory.com');
      const passwordInput = screen.getByPlaceholderText('Enter your admin password');
      
      await user.type(emailInput, 'admin@lawlessdirectory.com');
      await user.type(passwordInput, 'AdminPass123!');
      
      const submitButton = screen.getByRole('button', { name: /sign in to admin portal/i });
      await user.click(submitButton);
      
      // Wait for MFA step
      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      });
      
      // Should have session security indicators
      expect(screen.getByText('Session expires in')).toBeInTheDocument();
      expect(screen.getByText('Trust this device for 30 days')).toBeInTheDocument();
    });
  });

  describe('Security & Performance Tests', () => {
    it('validates IP address format in whitelist', async () => {
      const user = userEvent.setup();
      render(<SecuritySettings />);
      
      const addIPButton = screen.getByText('Add IP');
      await user.click(addIPButton);
      
      const ipInput = screen.getByPlaceholderText('192.168.1.100');
      await user.type(ipInput, 'invalid-ip');
      
      expect(screen.getByText('Please enter a valid IP address')).toBeInTheDocument();
    });

    it('enforces password complexity requirements', async () => {
      const user = userEvent.setup();
      render(<AdminLoginForm />);
      
      const emailInput = screen.getByPlaceholderText('admin@lawlessdirectory.com');
      const passwordInput = screen.getByPlaceholderText('Enter your admin password');
      
      await user.type(emailInput, 'admin@lawlessdirectory.com');
      await user.type(passwordInput, '123'); // Weak password
      
      const submitButton = screen.getByRole('button', { name: /sign in to admin portal/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('handles session timeout correctly', () => {
      render(<SessionManagement />);
      
      // Should display session duration
      expect(screen.getByText('2h')).toBeInTheDocument();
      expect(screen.getByText('45m')).toBeInTheDocument();
    });

    it('exports audit logs securely', async () => {
      const user = userEvent.setup();
      
      // Mock URL.createObjectURL and document.createElement
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      const mockClick = jest.fn();
      const mockCreateElement = jest.fn(() => ({
        href: '',
        download: '',
        click: mockClick
      }));
      document.createElement = mockCreateElement;
      
      render(<AuditLogViewer />);
      
      const exportButton = screen.getByText('Export');
      await user.click(exportButton);
      
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
    });
  });
});