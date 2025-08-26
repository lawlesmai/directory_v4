const createMockSupabase = () => {
  const mockFrom = jest.fn(() => ({
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockReturnThis()
  }));

  return {
    from: mockFrom,
    auth: {
      signOut: jest.fn().mockResolvedValue({}),
      admin: {
        deleteUser: jest.fn().mockResolvedValue({})
      }
    }
  };
};

jest.mock('../../lib/supabaseClient', () => {
  const mockSupabase = createMockSupabase();
  return { supabase: mockSupabase };
});

const { supabase } = require('../../lib/supabaseClient');
const { 
  syncSocialProfile, 
  exportUserData, 
  deleteUserProfile 
} = require('../../services/profile-service');

describe('Profile Management Integration Tests', () => {
  const testUser = {
    id: 'test-user-id',
    email: 'integration-test@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Social Profile Synchronization', async () => {
    const socialProfile = {
      provider: 'linkedin',
      profileData: {
        firstName: 'Test',
        lastName: 'User'
      }
    };

    const result = await syncSocialProfile(testUser.id, socialProfile);
    
    expect(supabase.from).toHaveBeenCalledWith('social_profiles');
    expect(supabase.from().insert).toHaveBeenCalledWith({
      user_id: testUser.id,
      provider: 'linkedin',
      profile_data: socialProfile.profileData
    });
    expect(result.success).toBe(true);
  });

  test('User Data Export Functionality', async () => {
    const exportData = await exportUserData(testUser.id);
    
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from().select).toHaveBeenCalledWith('*');
    expect(supabase.from().eq).toHaveBeenCalledWith('id', testUser.id);
    expect(exportData).toEqual({ 
      profile: {}, 
      preferences: undefined, 
      socialProfiles: undefined 
    });
  });

  test('Profile Deletion Workflow', async () => {
    const result = await deleteUserProfile(testUser.id);
    
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from().delete).toHaveBeenCalled();
    expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith(testUser.id);
    expect(result.success).toBe(true);
  });
});
