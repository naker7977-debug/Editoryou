import { redirect } from 'next/navigation';
import { requirePub } from '@/lib/pub';
import { canManageMembers } from '@press/db';
import { updatePublicationSettings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function Settings({ params }: { params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const { pub, role } = await requirePub(slug);
  if (!(role === 'superadmin' || canManageMembers(role))) redirect(`/p/${slug}`);
  const s = pub.settings ?? {};
  const action = updatePublicationSettings.bind(null, pub.id, pub.slug);
  return (
    <div className="p-8 max-w-3xl w-full">
      <div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">Pengaturan</div>
      <h1 className="font-display text-3xl mt-1 mb-6">Identitas {pub.name}</h1>
      <form action={action} className="card p-6">
        <div className="field"><label>Semboyan</label><input type="text" name="tagline" defaultValue={pub.tagline ?? ''} /></div>
        <div className="field"><label>Deskripsi (tampil di halaman penerbit)</label><textarea name="description" defaultValue={pub.description ?? ''} style={{ fontFamily: 'inherit', minHeight: 80 }} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="field"><label>Kota</label><input type="text" name="city" defaultValue={pub.city ?? ''} /></div>
          <div className="field"><label>Harga eceran</label><input type="text" name="price" defaultValue={s.price ?? ''} /></div>
          <div className="field"><label>Frekuensi</label><input type="text" name="frequency" defaultValue={s.frequency ?? ''} placeholder="Harian / Mingguan / Bulanan" /></div>
        </div>
        <div className="field"><label>Keterangan kop</label><input type="text" name="motto" defaultValue={s.motto ?? ''} placeholder="Terbit sejak 1962" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="field"><label>Gaya kop bawaan</label><select name="mastheadStyle" defaultValue={s.mastheadStyle ?? (pub.type === 'magazine' ? 'caps' : 'black')}><option value="black">Gotik klasik</option><option value="serif">Serif tebal</option><option value="caps">Kapital berjarak</option></select></div>
          <div className="field"><label>Kertas bawaan</label><select name="tone" defaultValue={s.tone ?? (pub.type === 'magazine' ? 'bright' : 'ivory')}><option value="ivory">Gading hangat</option><option value="aged">Kertas tua</option><option value="sepia">Sepia</option><option value="bright">Putih tulang</option></select></div>
          <div className="field"><label>Warna aksen</label><input type="color" name="accent" defaultValue={s.accent ?? '#8b1e1e'} className="h-9 w-full bg-transparent" /></div>
        </div>
        <p className="text-xs text-[var(--muted)] mb-4">Nilai ini menjadi bawaan untuk edisi baru. Nama & slug penerbit diubah oleh admin platform.</p>
        <button className="btn gold">Simpan pengaturan</button>
      </form>
    </div>
  );
}
