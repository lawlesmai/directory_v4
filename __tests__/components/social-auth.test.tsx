/**
 * Epic 2 Story 2.3: Social Media Login UI Components Test
 * Unit tests for sophisticated social authentication interface
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';
import { SocialAuthModal } from '@/components/auth/SocialAuthModal';
import { ProviderSelection } from '@/components/auth/ProviderSelection';
import { AuthProvider } from '@/components/auth/types';

// Mock dependencies
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    signInWithProvider: jest.fn(),
    state: 'idle',
  }))
}));

jest.mock('framer-motion', () => ({
  motion: {
    button: 'button',
    div: 'div',
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('Social Media Login UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SocialLoginButton', () => {
    test('renders Google login button with correct styling', () => {
      render(
        <SocialLoginButton 
          provider="google" 
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      expect(button).toBeDefined();
      expect(button).toHaveClass('bg-white');
      expect(button.textContent).toContain('Continue with Google');
    });

    test('renders Apple login button with correct styling', () => {
      render(
        <SocialLoginButton 
          provider="apple" 
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button', { name: /sign in with apple/i });
      expect(button).toBeDefined();
      expect(button).toHaveClass('bg-black');
      expect(button.textContent).toContain('Continue with Apple');
    });

    test('handles provider selection correctly', () => {
      const mockOnSelect = vi.fn();
      
      render(
        <ProviderSelection 
          providers={['google', 'apple', 'email']}
          onSelect={mockOnSelect}
        />
      );
      
      expect(screen.getByText('Google')).toBeDefined();
      expect(screen.getByText('Apple')).toBeDefined();
      expect(screen.getByText('Email & Password')).toBeDefined();
    });

    test('shows loading state during authentication', async () => {
      const mockSignIn = vi.fn(() => new Promise(() => {})); // Never resolving promise
      
      vi.mocked(require('@/contexts/AuthContext').useAuth).mockReturnValue({
        signInWithProvider: mockSignIn,
        state: 'loading',
      });

      render(
        <SocialLoginButton 
          provider="google" 
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(button.textContent).toContain('Signing in...');
      expect(button).toBeDisabled();
    });

    test('handles authentication errors gracefully', async () => {
      const mockError = new Error('Authentication failed');
      const mockOnError = vi.fn();
      const mockSignIn = vi.fn().mockRejectedValue(mockError);
      
      vi.mocked(require('@/contexts/AuthContext').useAuth).mockReturnValue({
        signInWithProvider: mockSignIn,
        state: 'error',
      });

      render(
        <SocialLoginButton 
          provider="google" 
          onSuccess={vi.fn()} 
          onError={mockOnError} 
        />
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Authentication failed',
            code: 'social_login_error'
          })
        );
      });
    });

    test('supports different button sizes', () => {
      const { rerender } = render(
        <SocialLoginButton 
          provider="google" 
          size="sm"
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      let button = screen.getByRole('button');
      expect(button).toHaveClass('px-3', 'py-2', 'text-sm');
      
      rerender(
        <SocialLoginButton 
          provider="google" 
          size="lg"
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      button = screen.getByRole('button');
      expect(button).toHaveClass('px-6', 'py-4', 'text-lg');
    });

    test('supports different button variants', () => {
      render(
        <SocialLoginButton 
          provider="google" 
          variant="outline"
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-transparent', 'border-2');
    });
  });

  describe('SocialAuthModal', () => {
    test('displays modal with provider options', () => {
      render(
        <SocialAuthModal 
          isOpen={true}
          onClose={vi.fn()}
          providers={['google', 'apple', 'github']}
        />
      );
      
      expect(screen.getByText(/sign in to your account/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /sign in with apple/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /sign in with github/i })).toBeDefined();
    });

    test('handles mode changes correctly', () => {
      const mockOnModeChange = vi.fn();
      
      render(
        <SocialAuthModal 
          isOpen={true}
          onClose={vi.fn()}
          mode="login"
          onModeChange={mockOnModeChange}
          allowModeSwitch={true}
        />
      );
      
      const signUpButton = screen.getByText(/sign up instead/i);
      fireEvent.click(signUpButton);
      
      expect(mockOnModeChange).toHaveBeenCalledWith('register');
    });
  });

  describe('Accessibility', () => {
    test('social login button has proper ARIA attributes', () => {
      render(
        <SocialLoginButton 
          provider="google" 
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button', { name: /sign in with google/i });
      expect(button).toHaveAttribute('aria-label', 'Sign in with Google');
    });

    test('supports keyboard navigation', () => {
      const mockOnSelect = vi.fn();
      
      render(
        <ProviderSelection 
          providers={['google', 'apple']}
          onSelect={mockOnSelect}
        />
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('tabIndex', '0');
      });
    });
  });

  describe('Provider-Specific Features', () => {
    test('Google button follows branding guidelines', () => {
      render(
        <SocialLoginButton 
          provider="google" 
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-white', 'text-gray-900');
    });

    test('Apple button uses correct styling', () => {
      render(
        <SocialLoginButton 
          provider="apple" 
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-black', 'text-white');
    });

    test('Facebook button has Facebook branding', () => {
      render(
        <SocialLoginButton 
          provider="facebook" 
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button.textContent).toContain('Continue with Facebook');
    });

    test('GitHub button has developer-friendly styling', () => {
      render(
        <SocialLoginButton 
          provider="github" 
          onSuccess={vi.fn()} 
          onError={vi.fn()} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button.textContent).toContain('Continue with GitHub');
    });
  });

  describe('Performance', () => {
    test('components render without performance issues', () => {
      const startTime = performance.now();
      
      render(
        <div>
          <SocialLoginButton provider="google" onSuccess={vi.fn()} onError={vi.fn()} />
          <SocialLoginButton provider="apple" onSuccess={vi.fn()} onError={vi.fn()} />
          <SocialLoginButton provider="facebook" onSuccess={vi.fn()} onError={vi.fn()} />
          <SocialLoginButton provider="github" onSuccess={vi.fn()} onError={vi.fn()} />
        </div>
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Components should render quickly (under 50ms is good)
      expect(renderTime).toBeLessThan(50);
    });
  });
});

// Mock data for testing
export const mockProviderConfigs = {
  google: {
    name: 'Google',
    buttonColor: '#4285F4',
    brandingGuidelines: {
      minimumWidth: 120,
      cornerRadius: 8,
      fontFamily: 'Roboto, sans-serif'
    }
  },
  apple: {
    name: 'Apple',
    buttonColor: '#000000',
    brandingGuidelines: {
      minimumWidth: 140,
      cornerRadius: 6,
      fontFamily: 'SF Pro Display, sans-serif'
    }
  },
  facebook: {
    name: 'Facebook',
    buttonColor: '#1877F2',
    brandingGuidelines: {
      minimumWidth: 120,
      cornerRadius: 6,
      fontFamily: 'Helvetica, sans-serif'
    }
  },
  github: {
    name: 'GitHub',
    buttonColor: '#24292e',
    brandingGuidelines: {
      minimumWidth: 120,
      cornerRadius: 6,
      fontFamily: 'system-ui, sans-serif'
    }
  }
};

export const createMockOAuthResponse = (provider: AuthProvider, success = true) => {
  if (success) {
    return {
      user: {
        id: `mock-${provider}-user-id`,
        email: `user@${provider}.com`,
        user_metadata: {
          full_name: `${provider} User`,
          avatar_url: `https://avatar.${provider}.com/user.jpg`,
          provider_id: `${provider}-123456`
        }
      },
      session: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_at: Date.now() + 3600000
      }
    };
  } else {
    return {
      error: {
        message: `Failed to authenticate with ${provider}`,
        code: `${provider}_auth_error`,
        status: 400
      }
    };
  }
};