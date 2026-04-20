import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oyqrqtfmppamwkymtjrx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cXJxdGZtcHBhbXdreW10anJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEwMzkwNywiZXhwIjoyMDkwNjc5OTA3fQ.cOQBklw9OC2mOJFGEh5z05tAhs3q-yHIBngKphv3J2o';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage // Forces mobile browsers to remember the login
  }
});