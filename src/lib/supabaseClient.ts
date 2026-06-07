import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hguhjojlzcufdkwrjzuz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndWhqb2psemN1ZmRrd3JqenV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzc1MzYsImV4cCI6MjA5NDY1MzUzNn0.5aZQiz3-nqChG7gFA16WsGOdptBG2qQi6NxPvnC1JSs';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
