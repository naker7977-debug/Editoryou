import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/** Klien service-role — HANYA di server (Route Handler / Server Action aplikasi admin). Melewati RLS. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diisi untuk aplikasi admin.');
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
