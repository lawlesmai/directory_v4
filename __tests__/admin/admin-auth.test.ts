import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { 
          user: { 
            id: 'admin-user-123', 
            user_metadata: { role: 'admin' } 
          } 
        },
        error: null
      }),
      signOut: jest.fn().mockResolvedValue({ error: null })
    }
  }))
}));

describe('Admin Authentication', () => {
  it('should handle admin login successfully', async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'secureAdminPassword123!'
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user.user_metadata.role).toBe('admin');
  });

  it('should prevent non-admin login', async () => {
    const supabase = createClient();
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
    mockSignIn.mockResolvedValueOnce({
      data: { 
        user: { 
          id: 'regular-user-456', 
          user_metadata: { role: 'user' } 
        } 
      },
      error: null
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'user@example.com',
      password: 'regularPassword123!'
    });

    expect(data.user.user_metadata.role).not.toBe('admin');
  });
});
