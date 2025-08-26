import { supabase } from '../lib/supabaseClient';

export const syncSocialProfile = async (userId: string, socialProfile: any) => {
  try {
    const { data, error } = await supabase
      .from('social_profiles')
      .insert({
        user_id: userId,
        provider: socialProfile.provider,
        profile_data: socialProfile.profileData
      });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Social profile sync error:', error);
    return { success: false, error };
  }
};

export const exportUserData = async (userId: string) => {
  try {
    const [profileData, preferencesData, socialProfilesData] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
      supabase.from('social_profiles').select('*').eq('user_id', userId)
    ]);

    return {
      profile: profileData.data,
      preferences: preferencesData.data,
      socialProfiles: socialProfilesData.data
    };
  } catch (error) {
    console.error('Data export error:', error);
    throw error;
  }
};

export const deleteUserProfile = async (userId: string) => {
  try {
    // Delete from multiple tables
    await Promise.all([
      supabase.from('profiles').delete().eq('id', userId),
      supabase.from('user_preferences').delete().eq('user_id', userId),
      supabase.from('social_profiles').delete().eq('user_id', userId),
      supabase.auth.admin.deleteUser(userId)
    ]);

    return { success: true };
  } catch (error) {
    console.error('Profile deletion error:', error);
    return { success: false, error };
  }
};
