import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { supabaseEnv } from './env';
import type { MemberRole, Profile, PublicationMember } from './types';

/** Klien Supabase untuk Server Components, Server Actions, dan Route Handlers (Next 15: cookies() async). */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anon } = supabaseEnv();
  return createServerClient(url, anon, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* dipanggil dari Server Component: cookie disegarkan oleh middleware */ }
      },
    },
  });
}

export async function getSession(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; user: User | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getSessionUser() {
  const { user } = await getSession();
  return user;
}

export async function getProfile(): Promise<{ user: User | null; profile: Profile | null }> {
  const { supabase, user } = await getSession();
  if (!user) return { user: null, profile: null };
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const profile = (data as Profile | null) ?? { id: user.id, email: user.email ?? null, full_name: '', role: 'user', created_at: '' };
  return { user, profile };
}

/** Peran pengguna saat ini di sebuah penerbit ('superadmin' bila admin platform; null bila bukan anggota). */
export async function getRoleIn(publicationId: string): Promise<MemberRole | 'superadmin' | null> {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const [{ data: prof }, { data: mem }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('publication_members').select('role').eq('publication_id', publicationId).eq('user_id', user.id).maybeSingle(),
  ]);
  if (prof?.role === 'superadmin') return 'superadmin';
  return (mem?.role as MemberRole) ?? null;
}

/** Keanggotaan redaksi pengguna saat ini, beserta data penerbitnya. */
export async function getMemberships(): Promise<PublicationMember[]> {
  const { supabase, user } = await getSession();
  if (!user) return [];
  const { data } = await supabase.from('publication_members').select('*, publications(*)').eq('user_id', user.id).order('created_at');
  return (data ?? []) as PublicationMember[];
}
