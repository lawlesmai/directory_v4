/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/admin',
  }),
  usePathname: () => '/admin',
}));

// Import components
import {
  AdminPortalWrapper,
  AdminDashboardLayout,
  AdminLoadingSpinner,
  AdminErrorBoundary,
  AdminNotificationProvider,
  AdminDataServiceProvider,
} from '@/components/admin';

describe('Admin Components', () => {
  describe('AdminLoadingSpinner', () => {
    it('renders with default props', () => {
      render(<AdminLoadingSpinner />);
      
      const spinner = screen.getByRole('generic'); // Loader2 icon renders as generic
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });

    it('applies correct size classes', () => {
      const { rerender } = render(<AdminLoadingSpinner size="sm" />);
      let spinner = screen.getByRole('generic');
      expect(spinner).toHaveClass('w-4', 'h-4');

      rerender(<AdminLoadingSpinner size="lg" />);
      spinner = screen.getByRole('generic');
      expect(spinner).toHaveClass('w-8', 'h-8');
    });

    it('applies correct variant classes', () => {
      const { rerender } = render(<AdminLoadingSpinner variant="primary" />);
      let spinner = screen.getByRole('generic');
      expect(spinner).toHaveClass('text-teal-primary');

      rerender(<AdminLoadingSpinner variant="accent" />);
      spinner = screen.getByRole('generic');
      expect(spinner).toHaveClass('text-red-400');
    });
  });

  describe('AdminErrorBoundary', () => {
    const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Normal content</div>;
    };

    it('renders children when no error occurs', () => {
      render(
        <AdminErrorBoundary>
          <ThrowError shouldThrow={false} />
        </AdminErrorBoundary>
      );

      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('renders error UI when error occurs', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <AdminErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AdminErrorBoundary>
      );

      expect(screen.getByText('Admin Portal Error')).toBeInTheDocument();
      expect(screen.getByText('An unexpected error occurred in the admin interface')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('shows retry button and handles retry', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <AdminErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AdminErrorBoundary>
      );

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('AdminDashboardLayout', () => {
    const mockUser = {
      id: 'test-admin',
      email: 'test@admin.com',
      name: 'Test Admin',
      role: 'super_admin' as const,
      status: 'active' as const,
      permissions: ['read:all', 'write:all'],
      createdAt: new Date(),
      loginCount: 10,
      ipWhitelist: [],
      mfaEnabled: true,
      trustedDevices: 1,
      failedAttempts: 0,
    };

    it('renders with admin portal branding', () => {
      render(
        <AdminDashboardLayout user={mockUser}>
          <div>Dashboard Content</div>
        </AdminDashboardLayout>
      );

      expect(screen.getByText('Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });

    it('renders navigation items', () => {
      render(
        <AdminDashboardLayout user={mockUser}>
          <div>Dashboard Content</div>
        </AdminDashboardLayout>
      );

      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
      expect(screen.getByText('System Settings')).toBeInTheDocument();
    });

    it('displays user information in header', () => {
      render(
        <AdminDashboardLayout user={mockUser}>
          <div>Dashboard Content</div>
        </AdminDashboardLayout>
      );

      expect(screen.getByText('Test Admin')).toBeInTheDocument();
      expect(screen.getByText('super admin')).toBeInTheDocument();
    });
  });

  describe('AdminNotificationProvider', () => {
    it('provides notification context to children', () => {
      const TestComponent = () => {
        return <div>Test with notifications</div>;
      };

      render(
        <AdminNotificationProvider>
          <TestComponent />
        </AdminNotificationProvider>
      );

      expect(screen.getByText('Test with notifications')).toBeInTheDocument();
    });
  });

  describe('AdminDataServiceProvider', () => {
    it('provides data service context to children', () => {
      const TestComponent = () => {
        return <div>Test with data service</div>;
      };

      render(
        <AdminDataServiceProvider>
          <TestComponent />
        </AdminDataServiceProvider>
      );

      expect(screen.getByText('Test with data service')).toBeInTheDocument();
    });
  });

  describe('AdminPortalWrapper', () => {
    it('renders complete admin portal structure', () => {
      const mockUser = {
        id: 'test-admin',
        email: 'test@admin.com',
        name: 'Test Admin',
        role: 'super_admin' as const,
        status: 'active' as const,
        permissions: ['read:all', 'write:all'],
        createdAt: new Date(),
        loginCount: 10,
        ipWhitelist: [],
        mfaEnabled: true,
        trustedDevices: 1,
        failedAttempts: 0,
      };

      render(
        <AdminPortalWrapper user={mockUser}>
          <div>Portal Content</div>
        </AdminPortalWrapper>
      );

      expect(screen.getByText('Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Portal Content')).toBeInTheDocument();
    });

    it('applies configuration options', () => {
      const mockUser = {
        id: 'test-admin',
        email: 'test@admin.com',
        name: 'Test Admin',
        role: 'super_admin' as const,
        status: 'active' as const,
        permissions: ['read:all', 'write:all'],
        createdAt: new Date(),
        loginCount: 10,
        ipWhitelist: [],
        mfaEnabled: true,
        trustedDevices: 1,
        failedAttempts: 0,
      };

      const config = {
        enableNotifications: false,
        enableErrorBoundary: false,
      };

      render(
        <AdminPortalWrapper user={mockUser} config={config}>
          <div>Portal Content</div>
        </AdminPortalWrapper>
      );

      expect(screen.getByText('Portal Content')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('handles error boundary with notifications', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const ErrorComponent = () => {
        throw new Error('Integration test error');
      };

      render(
        <AdminPortalWrapper>
          <ErrorComponent />
        </AdminPortalWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Portal Error')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('renders loading states correctly', () => {
      render(
        <AdminPortalWrapper>
          <AdminLoadingSpinner />
        </AdminPortalWrapper>
      );

      expect(screen.getByRole('generic')).toHaveClass('animate-spin');
    });
  });
});