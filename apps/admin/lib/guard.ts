import { redirect } from 'next/navigation';
import { getProfile } from '@press/db/server';
import { createAdminClient } from '@press/db/admin';
import type { Profile } from '@press/db';

/** Pastikan pengguna saat ini superadmin; kembalikan klien service-role untuk operasi admin. */
export async function requireSuperadmin(): Promise<{ profile: Profile; admin: ReturnType<typeof createAdminClient> }> {
  const { user, profile } = await getProfile();
  if (!user) redirect('/masuk');
  if (!profile || profile.role !== 'superadmin') redirect('/setup');
  return { profile, admin: createAdminClient() };
}
