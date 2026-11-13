import { redirect } from 'next/navigation';
import { getProfile } from '@press/db/server';
import { createAdminClient } from '@press/db/admin';
import { claimSuperadmin } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function Setup({ searchParams }: { searchParams: Promise<{ gagal?: string }> }) {
  const { user, profile } = await getProfile();
  if (!user) redirect('/masuk');
  const { gagal } = await searchParams;
  let hasSuper = true, svcOk = true, svcMsg = '';
  try { const admin = createAdminClient(); const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'superadmin'); if (error) throw error; hasSuper = (count ?? 0) > 0; }
  catch (e) { svcOk = false; svcMsg = (e as Error).message; }
  const checks = [
    ['NEXT_PUBLIC_SUPABASE_URL', !!process.env.NEXT_PUBLIC_SUPABASE_URL],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', !!process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['NEXT_PUBLIC_READER_URL', !!process.env.NEXT_PUBLIC_READER_URL],
    ['NEXT_PUBLIC_STUDIO_URL', !!process.env.NEXT_PUBLIC_STUDIO_URL],
  ] as const;
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16">
      <div className="card p-7 w-full max-w-lg">
        <div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">Penyiapan</div>
        <h1 className="font-display text-3xl mt-1 mb-4">Status platform</h1>
        <ul className="text-sm space-y-1 mb-5">
          {checks.map(([k, ok]) => <li key={k} className="flex justify-between"><code className="text-[var(--muted)]">{k}</code><span className={ok ? 'text-[#bfe5b9]' : 'text-[#f1b1a6]'}>{ok ? 'terisi' : 'kosong'}</span></li>)}
          <li className="flex justify-between"><span className="text-[var(--muted)]">Koneksi service role</span><span className={svcOk ? 'text-[#bfe5b9]' : 'text-[#f1b1a6]'}>{svcOk ? 'OK' : 'gagal'}</span></li>
        </ul>
        {!svcOk && <div className="warnbox mb-4">{svcMsg}</div>}
        <div className="text-sm text-[var(--muted)] mb-4">Masuk sebagai <b className="text-[var(--text)]">{user.email}</b> — peran: <b className="text-[var(--text)]">{profile?.role ?? 'user'}</b>.</div>
        {profile?.role === 'superadmin' ? (
          <a href="/" className="btn gold">Buka panel admin →</a>
        ) : !hasSuper ? (
          <form action={claimSuperadmin}>
            <p className="text-sm mb-3">Belum ada superadmin. Karena Anda yang pertama masuk, Anda dapat mengklaim peran superadmin untuk akun ini.</p>
            {gagal && <div className="warnbox mb-3">Klaim gagal — mungkin superadmin sudah ada.</div>}
            <button className="btn gold">Jadikan saya superadmin</button>
          </form>
        ) : (
          <div className="warnbox">Akun ini bukan superadmin. Minta superadmin yang ada untuk menaikkan peran Anda (menu Akun Redaksi → Jadikan superadmin).</div>
        )}
        <form action="/keluar" method="post" className="mt-4"><button className="text-xs text-[var(--muted)] hover:text-[var(--text)]">Keluar</button></form>
      </div>
    </main>
  );
}
