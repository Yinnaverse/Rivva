import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

// Placeholders keep the build working when the env vars are missing.
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  realtime: { params: { eventsPerSecond: 10 } },
});
