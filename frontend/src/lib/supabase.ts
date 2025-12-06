/**
 * Supabase Client Configuration
 *
 * This module initializes and exports the Supabase client for use throughout the application.
 * It handles authentication, database queries, and real-time subscriptions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl) {
  throw new Error(
    'Missing VITE_SUPABASE_URL environment variable. ' +
      'Please check your .env file and ensure VITE_SUPABASE_URL is set.',
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable. ' +
      'Please check your .env file and ensure VITE_SUPABASE_ANON_KEY is set.',
  );
}

/**
 * Initialize and export Supabase client
 * This client is used for all database operations, authentication, and real-time features.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Supabase client initialization check
 * Used to verify that the client is properly configured
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_profiles').select('id').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('✅ Supabase connection successful');
    return true;
  } catch (err) {
    console.error('Supabase connection test error:', err);
    return false;
  }
}

/**
 * Get current user session
 */
export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('Failed to get current session:', error);
    return null;
  }

  return session;
}

/**
 * Get current user profile with role information
 */
export async function getCurrentUserProfile() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }

  return data;
}

/**
 * Check if user has admin role
 */
export async function isUserAdmin(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.role === 'admin';
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Sign out failed:', error);
    return false;
  }

  return true;
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChanged(callback: (session: any) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return subscription;
}
