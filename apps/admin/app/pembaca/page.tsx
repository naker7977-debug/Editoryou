import { requireSuperadmin } from '@/lib/guard';
import { Shell, H1 } from '@/components/Shell';
import { Flash } from '@/components/Flash';
import { activateSubscription, cancelSubscription, createReader } from '@/lib/actions';
import { formatDate, formatIDR, type Plan, type Profile, type Subscription } from '@press/db';

export const dynamic = 'force-dynamic';

export default async function Readers({ searchParams }: { searchParams: Promise<{ q?: string; u?: string; ok?: string; err?: string }> }) {
  const { q, u, ok, err } = await searchParams;
  const { profile, admin } = await requireSuperadmin();
  let pq = admin.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
  if (q) pq = pq.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  const [{ data: profiles }, { data: subs }, { data: plans }] = await Promise.all([
    pq,
    admin.from('subscriptions').select('*, plans(name,interval), publications(name,slug), profiles(full_name,email)').order('created_at', { ascending: false }).limit(500),
    admin.from('plans').select('*, publications(name,slug)').eq('is_active', true).order('price_idr'),
  ]);
  const ps = (profiles ?? []) as Profile[]; const ss = (subs ?? []) as Subscription[]; const pl = (plans ?? []) as Plan[];
  const now = Date.now();
  const activeOf = (id: string) => ss.filter(s => s.user_id === id && s.status === 'active' && new Date(s.ends_at).getTime() > now);
  const selected = u ? ps.find(p => p.id === u) ?? null : null;
  return (
    <Shell who={profile.email ?? ''}>
      <H1 kicker="Pembaca" title="Pembaca & langganan" right={<form method="get"><input className="input" name="q" placeholder="Cari nama / surel…" defaultValue={q ?? ''} style={{ width: 240 }} /></form>} />
      <Flash ok={ok} err={err} />
      <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead><tr><th>Pembaca</th><th>Langganan aktif</th><th>Terdaftar</th><th></th></tr></thead>
            <tbody>
              {ps.map(p => { const act = activeOf(p.id); return (
                <tr key={p.id} className={u === p.id ? 'bg-[#2a231a]' : ''}>
                  <td><div className="font-medium">{p.full_name || '—'}</div><div className="text-xs text-[var(--muted)]">{p.email}</div></td>
                  <td>{act.length ? act.map(s => <div key={s.id} className="text-xs"><span className="badge green">{s.publications?.name ?? 'Semua'}</span> s.d. {formatDate(s.ends_at, { day: 'numeric', month: 'short', year: 'numeric' })} <form action={cancelSubscription.bind(null, s.id)} className="inline"><button className="text-[#f1b1a6] ml-1 hover:underline">batalkan</button></form></div>) : <span className="text-xs text-[var(--muted)]">—</span>}</td>
                  <td className="text-xs text-[var(--muted)]">{formatDate(p.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="text-right"><a href={`/pembaca?u=${p.id}${q ? '&q=' + encodeURIComponent(q) : ''}`} className="btn sm">Aktifkan</a></td>
                </tr>); })}
              {ps.length === 0 && <tr><td colSpan={4} className="text-center text-[var(--muted)] py-8">Tidak ada pengguna.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="space-y-6">
          <form action={activateSubscription} className="card p-5">
            <h2 className="font-display text-lg mb-1">Aktifkan langganan</h2>
            {selected ? <p className="text-sm mb-3">Untuk <b>{selected.full_name || selected.email}</b> <span className="text-xs text-[var(--muted)]">({selected.email})</span></p> : <p className="text-xs text-[var(--muted)] mb-3">Pilih pembaca di tabel (tombol “Aktifkan”), lalu pilih paket. Dipakai setelah pembayaran dikonfirmasi (transfer/manual).</p>}
            <input type="hidden" name="user_id" value={selected?.id ?? ''} />
            <div className="field"><label>Paket</label><select name="plan_id" required>{pl.map(p => <option key={p.id} value={p.id}>{p.name} — {formatIDR(p.price_idr)}/{p.interval === 'year' ? 'thn' : 'bln'}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Mulai</label><input type="date" name="starts_at" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div className="field"><label>Durasi (bulan)</label><input type="number" name="months" min={1} max={60} placeholder="otomatis dari paket" /></div>
            </div>
            <div className="field"><label>Referensi pembayaran</label><input type="text" name="payment_ref" placeholder="no. transfer / catatan" /></div>
            <button className="btn gold w-full justify-center" disabled={!selected || !pl.length}>Aktifkan</button>
            {!pl.length && <p className="text-xs text-[#f1b1a6] mt-2">Belum ada paket aktif — buat di menu Paket.</p>}
          </form>
          <form action={createReader} className="card p-5">
            <h2 className="font-display text-lg mb-1">Daftarkan pembaca manual</h2>
            <p className="text-xs text-[var(--muted)] mb-3">Untuk pelanggan yang mendaftar lewat telepon/kantor.</p>
            <div className="field"><label>Nama</label><input type="text" name="full_name" required /></div>
            <div className="field"><label>Surel</label><input type="email" name="email" required placeholder="nama@sekolah.sch.id" /></div>
            <div className="field"><label>Kata sandi</label><input type="text" name="password" required placeholder="min. 6 karakter" /></div>
            <button className="btn w-full justify-center">Buat akun pembaca</button>
          </form>
        </div>
      </div>
      <section className="card overflow-hidden mt-6">
        <div className="px-5 py-3 border-b border-[var(--line)] font-display text-lg">Riwayat langganan</div>
        <table className="tbl">
          <thead><tr><th>Pembaca</th><th>Paket</th><th>Periode</th><th>Ref.</th><th>Status</th></tr></thead>
          <tbody>{ss.slice(0, 100).map(s => <tr key={s.id}><td>{s.profiles?.full_name || s.profiles?.email}</td><td>{s.plans?.name} <span className="text-xs text-[var(--muted)]">· {s.publications?.name ?? 'Semua penerbit'}</span></td><td className="text-xs">{formatDate(s.starts_at, { day: 'numeric', month: 'short', year: 'numeric' })} – {formatDate(s.ends_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td className="text-xs text-[var(--muted)]">{s.payment_ref}</td><td><span className={'badge ' + (s.status === 'active' && new Date(s.ends_at).getTime() > now ? 'green' : 'red')}>{s.status === 'active' && new Date(s.ends_at).getTime() <= now ? 'kedaluwarsa' : s.status}</span></td></tr>)}</tbody>
        </table>
      </section>
    </Shell>
  );
}
