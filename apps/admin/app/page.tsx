import Link from 'next/link';
import { requireSuperadmin } from '@/lib/guard';
import { Shell, H1 } from '@/components/Shell';
import { EDITION_STATUS_LABEL, formatDate, type Edition, type Subscription } from '@press/db';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const { profile, admin } = await requireSuperadmin();
  const [{ data: stats }, { data: eds }, { data: subs }] = await Promise.all([
    admin.from('v_admin_stats').select('*').single(),
    admin.from('editions').select('id,title,number,status,edition_date,published_at,publications(name,slug,type)').order('updated_at', { ascending: false }).limit(8),
    admin.from('subscriptions').select('*, profiles(full_name,email), plans(name,interval), publications(name,slug)').order('created_at', { ascending: false }).limit(8),
  ]);
  const st = (stats ?? {}) as Record<string, number>;
  const cards: Array<[string, number | string, string]> = [
    ['Penerbit', st.publications ?? 0, '/penerbit'], ['Akun redaksi', st.members ?? 0, '/anggota'], ['Pengguna', st.users ?? 0, '/pembaca'], ['Edisi terbit', st.published_editions ?? 0, '/penerbit'], ['Langganan aktif', st.active_subscriptions ?? 0, '/pembaca'],
  ];
  return (
    <Shell who={profile.email ?? ''}>
      <H1 kicker="Ringkasan" title="Platform penerbitan" />
      <div className="grid sm:grid-cols-5 gap-3 mb-8">
        {cards.map(([l, v, h]) => <Link key={l} href={h} className="card p-4 hover:border-[var(--gold)]"><div className="text-[10px] tracking-[.2em] uppercase text-[var(--muted)]">{l}</div><div className="font-display text-3xl mt-1">{v}</div></Link>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="px-5 py-3 border-b border-[var(--line)] font-display text-lg">Aktivitas edisi</div>
          <ul>{((eds ?? []) as unknown as Edition[]).map(e => <li key={e.id} className="px-5 py-3 border-b border-[var(--line)] last:border-0 flex items-center gap-3"><div className="flex-1 min-w-0"><div className="truncate font-medium">{e.publications?.name} — {e.number || e.title}</div><div className="text-xs text-[var(--muted)]">{formatDate(e.edition_date, { day: 'numeric', month: 'long', year: 'numeric' })}</div></div><span className={'badge ' + (e.status === 'published' ? 'green' : '')}>{EDITION_STATUS_LABEL[e.status]}</span></li>)}
            {(eds ?? []).length === 0 && <li className="px-5 py-6 text-sm text-[var(--muted)]">Belum ada edisi.</li>}</ul>
        </section>
        <section className="card">
          <div className="px-5 py-3 border-b border-[var(--line)] font-display text-lg">Langganan terbaru</div>
          <ul>{((subs ?? []) as Subscription[]).map(s => <li key={s.id} className="px-5 py-3 border-b border-[var(--line)] last:border-0 flex items-center gap-3"><div className="flex-1 min-w-0"><div className="truncate font-medium">{s.profiles?.full_name || s.profiles?.email}</div><div className="text-xs text-[var(--muted)]">{s.plans?.name ?? 'Paket'} · {s.publications?.name ?? 'Semua penerbit'} · s.d. {formatDate(s.ends_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div><span className={'badge ' + (s.status === 'active' ? 'green' : 'red')}>{s.status}</span></li>)}
            {(subs ?? []).length === 0 && <li className="px-5 py-6 text-sm text-[var(--muted)]">Belum ada langganan.</li>}</ul>
        </section>
      </div>
      <section className="card p-5 mt-6 text-sm text-[var(--muted)] leading-relaxed">
        <b className="text-[var(--text)]">Langkah awal:</b> 1) Buat <Link className="underline" href="/penerbit">penerbit</Link> (koran/majalah). 2) Buat <Link className="underline" href="/anggota">akun redaksi</Link> dan tetapkan peran per penerbit — mereka masuk lewat Studio Redaksi. 3) Siapkan <Link className="underline" href="/paket">paket langganan</Link>. 4) Saat pembaca mendaftar & membayar, aktifkan langganannya di menu <Link className="underline" href="/pembaca">Pembaca</Link>.
      </section>
    </Shell>
  );
}
