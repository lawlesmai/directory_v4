export const createClient = jest.fn(() => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
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
    getSession: jest.fn(() => ({
      data: { session: { user: { id: 'mock-user-id' } } },
      error: null
    })),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } }
    }))
  }
}));
