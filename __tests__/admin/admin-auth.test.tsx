import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createClient } from '@supabase/supabase-js';
import AdminLoginForm from '@/components/admin/AdminLoginForm';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: { id: 'admin-user-123' } },
        error: null
      }),
      signOut: jest.fn().mockResolvedValue({ error: null })
    }
  }))
}));

describe('Admin Authentication', () => {
  it('renders login form', () => {
    render(<AdminLoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('handles successful login', async () => {
    render(<AdminLoginForm />);
    
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'securepassword123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(createClient().auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'securepassword123'
      });
    });
  });

  it('handles login error', async () => {
    // Mock login failure
    (createClient().auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid credentials' }
    });

    render(<AdminLoginForm />);
    
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'invalid@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpassword' } });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
