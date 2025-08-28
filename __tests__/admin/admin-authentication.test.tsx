import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createClient } from '@supabase/supabase-js';
import AdminLoginForm from '@/components/admin/AdminLoginForm';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn()
    }
  }))
}));

describe('Admin Authentication System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders admin login form correctly', () => {
    render(<AdminLoginForm />);
    
    expect(screen.getByLabelText(/admin email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to admin portal/i })).toBeInTheDocument();
  });

  it('handles successful admin login', async () => {
    const mockSignIn = createClient().auth.signInWithPassword as jest.Mock;
    mockSignIn.mockResolvedValue({
      data: { 
        user: { 
          id: 'admin-user-123', 
          user_metadata: { role: 'admin' } 
        } 
      },
      error: null
    });

    render(<AdminLoginForm />);
    
    fireEvent.change(screen.getByLabelText(/admin email/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secureAdminPassword123!' } });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in to admin portal/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'secureAdminPassword123!'
      });
    });
  });

  it('handles login failure', async () => {
    const mockSignIn = createClient().auth.signInWithPassword as jest.Mock;
    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials', code: 'INVALID_LOGIN' }
    });

    render(<AdminLoginForm />);
    
    fireEvent.change(screen.getByLabelText(/admin email/i), { target: { value: 'invalid-admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongPassword' } });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in to admin portal/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('prevents multiple simultaneous login attempts', async () => {
    const mockSignIn = createClient().auth.signInWithPassword as jest.Mock;
    mockSignIn.mockImplementation(() => new Promise(() => {})); // Simulate ongoing request

    render(<AdminLoginForm />);
    
    fireEvent.change(screen.getByLabelText(/admin email/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in to admin portal/i }));
    fireEvent.click(screen.getByRole('button', { name: /sign in to admin portal/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });
  });

  it('validates input requirements', () => {
    render(<AdminLoginForm />);
    
    const emailInput = screen.getByLabelText(/admin email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /sign in to admin portal/i });

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    expect(loginButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'validPassword123' } });

    expect(loginButton).not.toBeDisabled();
  });
});
