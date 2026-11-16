import { redirect } from 'next/navigation';
import { requirePub } from '@/lib/pub';
import { canManageMembers, layoutOpen } from '@press/db';
import { MOTION_FILTER_LABEL, type MotionFilter } from '@press/ui';
import { updatePublicationSettings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function Settings({ params }: { params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const { pub, role } = await requirePub(slug);
  if (!(role === 'superadmin' || canManageMembers(role))) redirect(`/p/${slug}`);
  const s = pub.settings ?? {};
  const action = updatePublicationSettings.bind(null, pub.id, pub.slug);
  const mo = pub.settings?.motion ?? {};
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
        <label className="flex items-start gap-3 card p-4 mb-4 cursor-pointer">
          <input type="checkbox" name="openLayout" defaultChecked={layoutOpen(pub)} className="mt-1 accent-[var(--gold)]" />
          <span className="text-sm"><b>Semua anggota tim boleh menata halaman & membuat edisi</b><br /><span className="text-[var(--muted)] text-xs">Cocok untuk tim kecil. Matikan bila tim sudah besar — penataan kembali khusus Pemimpin Redaksi, Redaktur, dan Penata Letak. Menerbitkan & menghapus edisi tetap khusus redaktur ke atas.</span></span>
        </label>
        <p className="text-xs text-[var(--muted)] mb-4">Nilai ini menjadi bawaan untuk edisi baru. Nama & slug penerbit diubah oleh admin platform.</p>
        <div className="card p-4 mb-4">
          <div className="font-bold text-sm mb-1">✦ Foto hidup</div>
          <p className="text-xs text-[var(--muted)] mb-3">Bawaan untuk <b>edisi baru</b>. Setiap edisi bisa diubah di editor (tab ⚙ Edisi), dan setiap foto bisa punya pengaturannya sendiri.</p>
          <label className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" name="motion_enabled" defaultChecked={mo.enabled !== false} className="accent-[var(--gold)]" /> Aktifkan foto hidup (video &amp; YouTube di halaman)</label>
          <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" name="motion_kiosk" defaultChecked={mo.kiosk !== false} className="accent-[var(--gold)]" /> Sampul ikut bergerak di rak kios pembaca</label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="field"><label>Cara putar</label><select name="motion_play" defaultValue={mo.play ?? 'auto'}><option value="auto">Otomatis berulang (tanpa suara)</option><option value="tap">Diam sampai diketuk</option></select></div>
            <div className="field"><label>Filter</label><select name="motion_filter" defaultValue={mo.filter ?? 'none'}>{(Object.keys(MOTION_FILTER_LABEL) as MotionFilter[]).map(f => <option key={f} value={f}>{MOTION_FILTER_LABEL[f]}</option>)}</select></div>
          </div>
        </div>
        <button className="btn gold">Simpan pengaturan</button>
      </form>
    </div>
  );
}
