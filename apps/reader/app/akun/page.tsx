import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDate, formatIDR, type Plan, type Subscription } from '@press/db';
import { createClient, getProfile } from '@press/db/server';

export const dynamic = 'force-dynamic';

export default async function Akun() {
  const { user, profile: prof } = await getProfile();
  if (!user) redirect('/masuk?next=/akun');
  const profile = prof ?? { id: user.id, email: user.email ?? null, full_name: '', role: 'user' as const, created_at: '' };
  const sb = await createClient();
  const [{ data: subs }, { data: plans }] = await Promise.all([
    sb.from('subscriptions').select('*, plans(*), publications(*)').eq('user_id', profile.id).order('ends_at', { ascending: false }),
    sb.from('plans').select('*, publications(name)').eq('is_active', true).order('price_idr'),
  ]);
  const now = Date.now();
  const active = ((subs ?? []) as Subscription[]).filter((s) => s.status === 'active' && new Date(s.ends_at).getTime() > now);
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold">Akun Saya</h1>
      <p className="font-garamond italic text-white/60">{profile.full_name || '—'} · {profile.email}</p>

      <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-display text-xl font-bold">Langganan</h2>
        {!active.length && <p className="mt-2 text-white/60">Belum ada langganan aktif.</p>}
        <ul className="mt-3 space-y-2">
          {active.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-black/30 px-4 py-3"><span>{s.publications?.name ?? 'Semua penerbit'} <span className="text-white/50">· {s.plans?.name}</span></span><span className="text-gold">aktif s.d. {formatDate(s.ends_at)}</span></li>)}
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-6">
        <h2 className="font-display text-xl font-bold">Cara berlangganan</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-white/80">
          <li>Pilih paket di bawah ini.</li>
          <li>Lakukan pembayaran ke rekening yang tertera pada halaman penerbit / hubungi admin, sertakan email akun Anda: <b>{profile.email}</b>.</li>
          <li>Admin akan mengaktifkan langganan Anda; status di halaman ini berubah menjadi aktif.</li>
        </ol>
        <ul className="mt-4 space-y-2">
          {((plans ?? []) as (Plan & { publications?: { name: string } | null })[]).map((p) => <li key={p.id} className="flex items-center justify-between rounded-md bg-black/30 px-4 py-3"><span>{p.name}{p.publications?.name ? ` · ${p.publications.name}` : ''}</span><b className="text-gold">{formatIDR(p.price_idr)} / {p.interval === 'year' ? 'tahun' : 'bulan'}</b></li>)}
        </ul>
        <p className="mt-3 text-xs text-white/50">Pembayaran daring otomatis (Midtrans/Xendit) akan tersedia pada tahap berikutnya.</p>
      </section>

      <div className="mt-8"><Link href="/" className="btn">‹ Kembali ke kios</Link></div>
    </div>
  );
}
