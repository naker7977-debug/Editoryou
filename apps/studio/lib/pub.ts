import { notFound, redirect } from 'next/navigation';
import { createClient, getRoleIn, getSession } from '@press/db/server';
import type { MemberRole, Publication } from '@press/db';

export interface PubContext { pub: Publication; role: MemberRole | 'superadmin'; userId: string }

/** Muat penerbit berdasarkan slug & pastikan pengguna adalah anggota (atau superadmin). */
export async function requirePub(slug: string): Promise<PubContext> {
  const { user } = await getSession();
  if (!user) redirect('/masuk');
  const supabase = await createClient();
  const { data: pub } = await supabase.from('publications').select('*').eq('slug', slug).maybeSingle();
  if (!pub) notFound();
  const role = await getRoleIn(pub.id);
  if (!role) redirect('/?denied=' + slug);
  return { pub: pub as Publication, role, userId: user.id };
}
