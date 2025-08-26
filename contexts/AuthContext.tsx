'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { 
  AuthContextType, 
  UserProfile, 
  AuthState, 
  AuthError, 
  AuthProvider as AuthProviderType,
  SecurityContext,
  DeviceInfo
} from '@/components/auth/types';

// Device detection utilities
const getDeviceInfo = (): DeviceInfo => {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      platform: 'unknown',
      supportsWebAuthn: false,
      supportsTouchID: false,
      supportsFaceID: false
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTablet = /ipad|android(?!.*mobi)/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;

  let platform: DeviceInfo['platform'] = 'unknown';
  if (/mac/i.test(userAgent)) platform = 'macos';
  else if (/win/i.test(userAgent)) platform = 'windows';
  else if (/linux/i.test(userAgent)) platform = 'linux';
  else if (/ios/i.test(userAgent)) platform = 'ios';
  else if (/android/i.test(userAgent)) platform = 'android';

  return {
    isMobile,
    isTablet,
    isDesktop,
    platform,
    supportsWebAuthn: 'credentials' in navigator && 'create' in navigator.credentials,
    supportsTouchID: platform === 'ios' && 'TouchID' in window,
    supportsFaceID: platform === 'ios' && 'FaceID' in window
  };
};

// Session storage keys
const SESSION_KEYS = {
  USER: 'auth_user',
  PROFILE: 'auth_profile',
  SESSION_ID: 'auth_session_id',
  DEVICE_ID: 'auth_device_id',
  LAST_ACTIVITY: 'auth_last_activity',
} as const;

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Security context for session management
const createSecurityContext = (user: User | null, deviceId: string): SecurityContext | null => {
  if (!user || typeof window === 'undefined') return null;

  return {
    sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    lastActivity: new Date(),
    deviceId,
    ipAddress: '', // Would be populated by server
    userAgent: navigator.userAgent,
    isSecureContext: window.isSecureContext,
    hasActiveSession: !!user
  };
};

// Generate device ID
const generateDeviceId = (): string => {
  const stored = localStorage.getItem(SESSION_KEYS.DEVICE_ID);
  if (stored) return stored;
  
  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem(SESSION_KEYS.DEVICE_ID, deviceId);
  return deviceId;
};

// Auth Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [state, setState] = useState<AuthState>('idle');
  const [deviceInfo] = useState<DeviceInfo>(getDeviceInfo);
  const [deviceId] = useState<string>(() => 
    typeof window !== 'undefined' ? generateDeviceId() : 'server'
  );
  const [securityContext, setSecurityContext] = useState<SecurityContext | null>(null);
  const [sessionSyncInterval, setSessionSyncInterval] = useState<NodeJS.Timeout | null>(null);
  
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Memoized error formatter
  const formatAuthError = useCallback((error: any): AuthError => {
    return {
      message: error?.message || 'An unexpected error occurred',
      status: error?.status || 500,
      code: error?.code || 'unknown_error',
      details: error
    };
  }, []);

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, new Date().toISOString());
      setSecurityContext(prev => prev ? { ...prev, lastActivity: new Date() } : null);
    }
  }, []);

  // Session synchronization across tabs
  const syncSessionAcrossTabs = useCallback(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_KEYS.USER) {
        const userData = e.newValue ? JSON.parse(e.newValue) : null;
        setUser(userData);
        setState(userData ? 'authenticated' : 'unauthenticated');
      }
      if (e.key === SESSION_KEYS.PROFILE) {
        const profileData = e.newValue ? JSON.parse(e.newValue) : null;
        setProfile(profileData);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  // Fetch user profile data
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      // This would be replaced with actual Supabase profile fetch
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn('Profile fetch failed:', error);
        // Return mock profile for now
        return {
          id: userId,
          email: user?.email || '',
          firstName: 'User',
          lastName: 'Name',
          fullName: 'User Name',
          businessType: 'customer',
          isEmailVerified: user?.email_confirmed_at ? true : false,
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
          createdAt: user?.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, [supabase, user]);

  // Initialize authentication state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (!mounted) return;
      
      setState('loading');
      
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          setState('error');
          return;
        }

        if (session?.user && mounted) {
          setUser(session.user);
          setState('authenticated');
          
          // Fetch user profile
          const userProfile = await fetchProfile(session.user.id);
          if (mounted) {
            setProfile(userProfile);
            setSecurityContext(createSecurityContext(session.user, deviceId));
          }

          // Store in localStorage for cross-tab sync
          if (typeof window !== 'undefined') {
            localStorage.setItem(SESSION_KEYS.USER, JSON.stringify(session.user));
            if (userProfile) {
              localStorage.setItem(SESSION_KEYS.PROFILE, JSON.stringify(userProfile));
            }
          }
        } else if (mounted) {
          setState('unauthenticated');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setState('error');
        }
      }
    };

    initializeAuth();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state changed:', event, session?.user?.id);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setState('authenticated');
          
          const userProfile = await fetchProfile(session.user.id);
          if (mounted) {
            setProfile(userProfile);
            setSecurityContext(createSecurityContext(session.user, deviceId));
          }

          // Store in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(SESSION_KEYS.USER, JSON.stringify(session.user));
            if (userProfile) {
              localStorage.setItem(SESSION_KEYS.PROFILE, JSON.stringify(userProfile));
            }
          }

          // Clear React Query cache on new login
          queryClient.clear();
        } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
            setSecurityContext(null);
            setState('unauthenticated');

            // Clear localStorage
            if (typeof window !== 'undefined') {
              Object.values(SESSION_KEYS).forEach(key => {
                localStorage.removeItem(key);
              });
            }

            // Clear React Query cache on logout
            queryClient.clear();
          } else if (event === 'TOKEN_REFRESHED' && session?.user && mounted) {
            setUser(session.user);
            setSecurityContext(createSecurityContext(session.user, deviceId));
          }
        }

        updateLastActivity();
      }
    );

    // Setup cross-tab synchronization
    const cleanupSync = syncSessionAcrossTabs();

    // Setup activity tracking interval
    const interval = setInterval(() => {
      if (user) {
        updateLastActivity();
      }
    }, 60000); // Update every minute

    setSessionSyncInterval(interval);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      cleanupSync?.();
      if (interval) clearInterval(interval);
    };
  }, [supabase, fetchProfile, deviceId, queryClient, updateLastActivity, syncSessionAcrossTabs, user]);

  // Sign in with email and password
  const signIn = useCallback(async (
    email: string, 
    password: string, 
    options?: { rememberMe?: boolean; redirectTo?: string }
  ) => {
    setState('loading');
    updateLastActivity();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setState('unauthenticated');
        return { user: null, error: formatAuthError(error) };
      }

      // Note: User state will be updated by the auth state change listener
      return { user: data.user, error: null };
    } catch (error) {
      setState('error');
      return { user: null, error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError, updateLastActivity]);

  // Sign up with email and password
  const signUp = useCallback(async (
    email: string, 
    password: string, 
    userData: Partial<UserProfile>
  ) => {
    setState('loading');
    updateLastActivity();

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            business_type: userData.businessType
          }
        }
      });

      if (error) {
        setState('unauthenticated');
        return { user: null, error: formatAuthError(error) };
      }

      return { user: data.user, error: null };
    } catch (error) {
      setState('error');
      return { user: null, error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError, updateLastActivity]);

  // Sign out
  const signOut = useCallback(async () => {
    setState('loading');
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return { error: formatAuthError(error) };
      }

      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError]);

  // Sign in with OAuth provider
  const signInWithProvider = useCallback(async (
    provider: AuthProviderType,
    options?: { redirectTo?: string }
  ) => {
    setState('loading');
    updateLastActivity();

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setState('unauthenticated');
        return { user: null, error: formatAuthError(error) };
      }

      // OAuth redirects, so we don't get user data immediately
      return { user: null, error: null };
    } catch (error) {
      setState('error');
      return { user: null, error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError, updateLastActivity]);

  // Send magic link
  const sendMagicLink = useCallback(async (
    email: string,
    options?: { redirectTo?: string }
  ) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        return { error: formatAuthError(error) };
      }

      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError]);

  // Send password reset
  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) {
        return { error: formatAuthError(error) };
      }

      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError]);

  // Reset password with token
  const resetPassword = useCallback(async (password: string, token: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        return { error: formatAuthError(error) };
      }

      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError]);

  // Verify email
  const verifyEmail = useCallback(async (token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email'
      });

      if (error) {
        return { error: formatAuthError(error) };
      }

      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError]);

  // Resend verification
  const resendVerification = useCallback(async () => {
    if (!user?.email) {
      return { error: { message: 'No user email found', code: 'no_email' } };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      });

      if (error) {
        return { error: formatAuthError(error) };
      }

      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError, user]);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { error: { message: 'No authenticated user', code: 'no_user' } };
    }

    try {
      // Update auth metadata if needed
      const authUpdates: Record<string, any> = {};
      if (updates.firstName || updates.lastName) {
        authUpdates.data = {
          first_name: updates.firstName,
          last_name: updates.lastName,
          full_name: `${updates.firstName || profile?.firstName} ${updates.lastName || profile?.lastName}`.trim()
        };
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(authUpdates);
        if (authError) {
          return { error: formatAuthError(authError) };
        }
      }

      // Update profile in database
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (profileError) {
        return { error: formatAuthError(profileError) };
      }

      // Update local state
      if (profile) {
        const updatedProfile = { ...profile, ...updates };
        setProfile(updatedProfile);
        
        // Update localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_KEYS.PROFILE, JSON.stringify(updatedProfile));
        }
      }

      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError, user, profile]);

  // Delete account
  const deleteAccount = useCallback(async () => {
    if (!user) {
      return { error: { message: 'No authenticated user', code: 'no_user' } };
    }

    try {
      // This would require admin privileges or custom function
      // For now, we'll just sign out
      return await signOut();
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [signOut, formatAuthError, user]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const { error } = await supabase.auth.refreshSession();
      
      if (error) {
        return { error: formatAuthError(error) };
      }

      updateLastActivity();
      return { error: null };
    } catch (error) {
      return { error: formatAuthError(error) };
    }
  }, [supabase, formatAuthError, updateLastActivity]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    profile,
    state,
    signIn,
    signUp,
    signOut,
    signInWithProvider,
    sendMagicLink,
    sendPasswordReset,
    resetPassword,
    verifyEmail,
    resendVerification,
    updateProfile,
    deleteAccount,
    refreshSession
  }), [
    user,
    profile,
    state,
    signIn,
    signUp,
    signOut,
    signInWithProvider,
    sendMagicLink,
    sendPasswordReset,
    resetPassword,
    verifyEmail,
    resendVerification,
    updateProfile,
    deleteAccount,
    refreshSession
  ]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (sessionSyncInterval) {
        clearInterval(sessionSyncInterval);
      }
    };
  }, [sessionSyncInterval]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Hook for auth state only
export const useAuthState = () => {
  const { state, user } = useAuth();
  return { state, isAuthenticated: !!user, user };
};

// Hook for user data only
export const useUser = () => {
  const { user, profile } = useAuth();
  return { user, profile };
};

// Hook for session management
export const useSession = () => {
  const { user, state, refreshSession, signOut } = useAuth();
  
  const isActive = state === 'authenticated' && !!user;
  
  return {
    isActive,
    user,
    refresh: refreshSession,
    end: signOut
  };
};

export default AuthProvider;