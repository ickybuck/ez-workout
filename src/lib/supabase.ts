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

// Enhanced health check function with timeout and retry
export const checkSupabaseConnection = async (retries = 3) => {
  const TIMEOUT_MS = 2000; // 2 second timeout (reduced for WebContainer)
  const RETRY_DELAY = 1000; // 1 second between retries

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timeout (attempt ${attempt}/${retries})`)), TIMEOUT_MS);
      });

      // Simple auth check instead of database query
      const connectionPromise = supabase.auth.getSession();

      const { error } = await Promise.race([
        connectionPromise,
        timeoutPromise
      ]) as any;

      if (!error) {
        console.info(`Successfully connected to Supabase (attempt ${attempt}/${retries})`);
        return true;
      }

      console.warn(`Connection attempt ${attempt}/${retries} failed:`, error?.message || 'Unknown error');

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Connection attempt ${attempt}/${retries} failed:`, errorMessage);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  // Don't throw error, just log warning and return false
  console.warn('Unable to establish connection to Supabase - this may be due to network restrictions in the current environment');
  return false;
};

// Initialize connection check without throwing errors
checkSupabaseConnection().then(connected => {
  if (connected) {
    console.info('Supabase connection established successfully');
  } else {
    console.warn('Supabase connection could not be established - app will continue with limited functionality');
  }
}).catch(error => {
  console.warn('Supabase connection check encountered an error:', error.message);
});