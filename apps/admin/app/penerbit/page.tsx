import Link from 'next/link';
import { requireSuperadmin } from '@/lib/guard';
import { Shell, H1 } from '@/components/Shell';
import { createPublication } from '@/lib/actions';
import type { Publication } from '@press/db';

export const dynamic = 'force-dynamic';

export default async function Publishers() {
  const { profile, admin } = await requireSuperadmin();
  const { data } = await admin.from('publications').select('*, publication_members(count), editions(count)').order('created_at');
  const pubs = (data ?? []) as Array<Publication & { publication_members: { count: number }[]; editions: { count: number }[] }>;
  return (
    <Shell who={profile.email ?? ''}>
      <H1 kicker="Penerbit" title="Koran & majalah" />
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead><tr><th>Nama</th><th>Jenis</th><th>Slug</th><th>Anggota</th><th>Edisi</th><th>Status</th></tr></thead>
            <tbody>
              {pubs.map(p => (
                <tr key={p.id}>
                  <td><Link href={`/penerbit/${p.id}`} className="font-medium hover:text-[var(--gold)]">{p.name}</Link><div className="text-xs text-[var(--muted)]">{p.tagline}</div></td>
                  <td>{p.type === 'magazine' ? 'Majalah' : 'Koran'}</td>
                  <td className="text-[var(--muted)]"><code>{p.slug}</code></td>
                  <td>{p.publication_members?.[0]?.count ?? 0}</td>
                  <td>{p.editions?.[0]?.count ?? 0}</td>
                  <td><span className={'badge ' + (p.is_active ? 'green' : 'red')}>{p.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                </tr>
              ))}
              {pubs.length === 0 && <tr><td colSpan={6} className="text-center text-[var(--muted)] py-8">Belum ada penerbit.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={createPublication} className="card p-5">
          <h2 className="font-display text-lg mb-3">Penerbit baru</h2>
          <div className="field"><label>Nama</label><input type="text" name="name" required placeholder="Warta Nusantara" /></div>
          <div className="field"><label>Slug (URL)</label><input type="text" name="slug" required pattern="[a-z0-9-]{2,60}" placeholder="warta-nusantara" /></div>
          <div className="field"><label>Jenis</label><select name="type"><option value="newspaper">Koran</option><option value="magazine">Majalah</option></select></div>
          <div className="field"><label>Semboyan</label><input type="text" name="tagline" /></div>
          <div className="field"><label>Kota</label><input type="text" name="city" /></div>
          <button className="btn gold w-full justify-center">Buat penerbit</button>
        </form>
      </div>
    </Shell>
  );
}
