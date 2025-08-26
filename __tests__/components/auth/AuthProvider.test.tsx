/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, useAuthState } from '@/contexts/AuthContext';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    signInWithOAuth: jest.fn(),
    signInWithOtp: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    verifyOtp: jest.fn(),
    resend: jest.fn(),
    refreshSession: jest.fn()
  },
  from: jest.fn()
};

// Mock the Supabase client module
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient
}));

// Test component that uses auth
const TestComponent: React.FC = () => {
  const { user, state, signIn, signOut } = useAuth();
  const { isAuthenticated } = useAuthState();

  return (
    <div>
      <div data-testid="auth-state">{state}</div>
      <div data-testid="is-authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="user-id">{user?.id || 'no-user'}</div>
      <button
        data-testid="sign-in-btn"
        onClick={() => signIn('test@example.com', 'password123')}
      >
        Sign In
      </button>
      <button data-testid="sign-out-btn" onClick={() => signOut()}>
        Sign Out
      </button>
    </div>
  );
};

// Wrapper component with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    });
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    });
  });

  it('should initialize with unauthenticated state', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
    });
  });

  it('should initialize with authenticated state when session exists', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };

    const mockSession = {
      user: mockUser,
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token'
    };

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'user-123',
              email: 'test@example.com',
              firstName: 'Test',
              lastName: 'User',
              fullName: 'Test User',
              businessType: 'customer',
              isEmailVerified: true,
              isPhoneVerified: false,
              preferences: {
                theme: 'system',
                notifications: {
                  email: true,
                  push: true,
                  marketing: false
                },
                privacy: {
                  profileVisible: true,
                  allowDirectMessages: true
                },
                accessibility: {
                  reducedMotion: false,
                  highContrast: false,
                  largeText: false
                }
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            error: null
          })
        })
      })
    });

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
    });
  });

  it('should handle successful sign in', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
    });

    // Click sign in button
    const signInBtn = screen.getByTestId('sign-in-btn');
    act(() => {
      signInBtn.click();
    });

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('loading');
    });

    // Verify signInWithPassword was called with correct parameters
    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });

  it('should handle sign in error', async () => {
    const mockError = {
      message: 'Invalid login credentials',
      status: 400
    };

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: mockError
    });

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
    });

    // Click sign in button
    const signInBtn = screen.getByTestId('sign-in-btn');
    act(() => {
      signInBtn.click();
    });

    // Should return to unauthenticated state on error
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
    });
  });

  it('should handle sign out', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };

    // Start with authenticated state
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    });

    mockSupabaseClient.auth.signOut.mockResolvedValue({
      error: null
    });

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Wait for authenticated state
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
    });

    // Click sign out button
    const signOutBtn = screen.getByTestId('sign-out-btn');
    act(() => {
      signOutBtn.click();
    });

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('loading');
    });

    // Verify signOut was called
    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
  });

  it('should handle auth state changes', async () => {
    let authStateCallback: ((event: string, session: any) => void) | null = null;

    mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return {
        data: { subscription: { unsubscribe: jest.fn() } }
      };
    });

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
    });

    // Simulate SIGNED_IN event
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };

    const mockSession = {
      user: mockUser,
      access_token: 'mock-token'
    };

    if (authStateCallback) {
      act(() => {
        authStateCallback('SIGNED_IN', mockSession);
      });
    }

    // Should update to authenticated state
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
    });

    // Simulate SIGNED_OUT event
    if (authStateCallback) {
      act(() => {
        authStateCallback('SIGNED_OUT', null);
      });
    }

    // Should update to unauthenticated state
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
    });
  });

  it('should cleanup on unmount', async () => {
    const mockUnsubscribe = jest.fn();
    
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } }
    });

    const { unmount } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Unmount the component
    unmount();

    // Should have called unsubscribe
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should throw error when useAuth is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});