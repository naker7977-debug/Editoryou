import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export type ServiceKeyKind = 'secret' | 'service_role' | 'publishable' | 'anon' | 'missing' | 'unknown';

/** Kenali jenis kunci tanpa pernah menampilkan isinya. */
export function serviceKeyKind(key = process.env.SUPABASE_SERVICE_ROLE_KEY): ServiceKeyKind {
  const k = key?.trim();
  if (!k) return 'missing';
  if (k.startsWith('sb_secret_')) return 'secret';
  if (k.startsWith('sb_publishable_')) return 'publishable';
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      if (payload?.role === 'service_role') return 'service_role';
      if (payload?.role === 'anon') return 'anon';
    } catch { /* bukan JWT */ }
  }
  return 'unknown';
}

export const SERVICE_KEY_HINT =
  'SUPABASE_SERVICE_ROLE_KEY di Vercel (project admin) berisi kunci publik, bukan kunci rahasia. ' +
  'Salin "Secret key" (diawali sb_secret_) dari Supabase → Project Settings → API Keys, tempel ke variabel itu, lalu Redeploy.';

/** Klien service-role — HANYA di server (Route Handler / Server Action aplikasi admin). Melewati RLS. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diisi untuk aplikasi admin.');
  const kind = serviceKeyKind(key);
  if (kind === 'publishable' || kind === 'anon') throw new Error(SERVICE_KEY_HINT);
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
