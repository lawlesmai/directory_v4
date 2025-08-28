import { vi } from 'vitest';

export const createClient = vi.fn(() => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({
          data: {
            id: 'mock-user-id',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User',
            businessType: 'admin',
            isEmailVerified: true
          },
          error: null
        }))
      }))
    }))
  })),
  auth: {
    getSession: vi.fn(() => ({
      data: { session: { user: { id: 'mock-user-id' } } },
      error: null
    })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    }))
  }
}));
