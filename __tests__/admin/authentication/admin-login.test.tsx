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

describe('Admin Login Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form correctly', () => {
    render(<AdminLoginForm />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
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
    
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secureAdminPassword123!' } });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

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
      error: { message: 'Invalid admin credentials', code: 'AUTH_ERROR' }
    });

    render(<AdminLoginForm />);
    
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'invalid-admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongPassword' } });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid admin credentials/i)).toBeInTheDocument();
    });
  });

  it('validates input fields', () => {
    render(<AdminLoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    expect(loginButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });

    expect(loginButton).toBeDisabled();
  });

  it('prevents multiple login attempts', async () => {
    const mockSignIn = createClient().auth.signInWithPassword as jest.Mock;
    mockSignIn.mockImplementation(() => new Promise(() => {})); // Simulate ongoing request

    render(<AdminLoginForm />);
    
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Check that second click doesn't trigger another login attempt
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });
  });
});
