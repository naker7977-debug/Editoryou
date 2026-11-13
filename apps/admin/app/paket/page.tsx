import { requireSuperadmin } from '@/lib/guard';
import { Shell, H1 } from '@/components/Shell';
import { createPlan, togglePlan } from '@/lib/actions';
import { formatIDR, type Plan, type Publication } from '@press/db';

export const dynamic = 'force-dynamic';

export default async function Plans() {
  const { profile, admin } = await requireSuperadmin();
  const [{ data: plans }, { data: pubs }] = await Promise.all([
    admin.from('plans').select('*, publications(name,slug)').order('created_at'),
    admin.from('publications').select('id,name,slug,type').order('name'),
  ]);
  const pl = (plans ?? []) as Plan[];
  return (
    <Shell who={profile.email ?? ''}>
      <H1 kicker="Paket" title="Paket langganan" />
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead><tr><th>Nama paket</th><th>Cakupan</th><th>Harga</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {pl.map(p => <tr key={p.id}><td className="font-medium">{p.name}</td><td className="text-[var(--muted)]">{p.publications?.name ?? 'Semua penerbit'}</td><td>{formatIDR(p.price_idr)} / {p.interval === 'year' ? 'tahun' : 'bulan'}</td><td><span className={'badge ' + (p.is_active ? 'green' : 'red')}>{p.is_active ? 'Aktif' : 'Nonaktif'}</span></td><td className="text-right"><form action={togglePlan.bind(null, p.id, !p.is_active)}><button className="btn sm">{p.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></form></td></tr>)}
              {pl.length === 0 && <tr><td colSpan={5} className="text-center text-[var(--muted)] py-8">Belum ada paket.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={createPlan} className="card p-5">
          <h2 className="font-display text-lg mb-3">Paket baru</h2>
          <div className="field"><label>Nama</label><input type="text" name="name" required placeholder="Langganan Bulanan" /></div>
          <div className="field"><label>Cakupan</label><select name="publication_id"><option value="">Semua penerbit</option>{((pubs ?? []) as Publication[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label>Interval</label><select name="interval"><option value="month">Bulanan</option><option value="year">Tahunan</option></select></div>
            <div className="field"><label>Harga (Rp)</label><input type="number" name="price_idr" min={0} step={1000} required /></div>
          </div>
          <button className="btn gold w-full justify-center">Buat paket</button>
          <p className="text-xs text-[var(--muted)] mt-3">Integrasi pembayaran (Midtrans/Xendit) akan memakai kolom <code>payment_ref</code> pada langganan.</p>
        </form>
      </div>
    </Shell>
  );
}
