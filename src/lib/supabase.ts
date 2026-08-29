import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced environment variable validation
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is missing in environment variables');
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is missing in environment variables');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error(`Invalid VITE_SUPABASE_URL format: ${supabaseUrl}`);
}

// Clean the URL by removing trailing slashes and ensuring https protocol
const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '').replace(/^http:/, 'https:');
if (!cleanUrl.startsWith('https://')) {
  throw new Error('Supabase URL must use HTTPS protocol');
}

// Initialize Supabase client with enhanced error handling
export const supabase = createClient<Database>(cleanUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'workout-tracker-auth'
  },
  global: {
    headers: {
      'X-Client-Info': 'workout-tracker@0.0.0'
    }
  },
  db: {
    schema: 'public'
  }
});

/*
 * The connection probe that used to live here has been removed (EZ-18).
 *
 * It ran three attempts with a 2 second timeout and a 1 second backoff, was
 * invoked as a bare side effect at module import, and was then called AGAIN
 * by useAdminStatus, Dashboard and Login before their own queries — so a
 * page with two of those consumers paid for it twice over, up to six seconds
 * of retries before anything rendered. Its comment ("reduced for
 * WebContainer") gives it away as a bolt.new preview workaround.
 *
 * A pre-flight check cannot tell you the next request will succeed. Handle
 * failure where it actually surfaces: in the query's own error path.
 */
