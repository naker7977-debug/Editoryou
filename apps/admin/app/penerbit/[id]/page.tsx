import { notFound } from 'next/navigation';
import { requireSuperadmin } from '@/lib/guard';
import { Shell, H1 } from '@/components/Shell';
import { addMember, deletePublication, removeMember, updateMemberRole, updatePublication } from '@/lib/actions';
import { ROLE_LABEL, formatDate, type MemberRole, type Publication, type PublicationMember } from '@press/db';
import { RoleSelect } from '@/components/RoleSelect';
import { Flash } from '@/components/Flash';

export const dynamic = 'force-dynamic';

export default async function PublisherDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const { ok, err } = await searchParams;
  const { profile, admin } = await requireSuperadmin();
  const [{ data: pub }, { data: members }] = await Promise.all([
    admin.from('publications').select('*').eq('id', id).maybeSingle(),
    admin.from('publication_members').select('*, profiles(*)').eq('publication_id', id).order('created_at'),
  ]);
  if (!pub) notFound();
  const p = pub as Publication; const ms = (members ?? []) as PublicationMember[];
  const back = `/penerbit/${id}`;
  const roles = Object.keys(ROLE_LABEL) as MemberRole[];
  const studio = process.env.NEXT_PUBLIC_STUDIO_URL;
  return (
    <Shell who={profile.email ?? ''}>
      <H1 kicker="Penerbit" title={p.name} right={<div className="flex gap-2">{studio && <a className="btn sm" href={`${studio}/p/${p.slug}`} target="_blank" rel="noreferrer">Buka di Studio ↗</a>}
        <form action={deletePublication.bind(null, id)}><button className="btn sm" style={{ color: '#f1b1a6' }}>Hapus penerbit</button></form></div>} />
      <Flash ok={ok} err={err} />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <form action={updatePublication.bind(null, id)} className="card p-5">
          <h2 className="font-display text-lg mb-3">Identitas</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label>Nama</label><input type="text" name="name" defaultValue={p.name} required /></div>
            <div className="field"><label>Slug</label><input type="text" name="slug" defaultValue={p.slug} pattern="[a-z0-9-]{2,60}" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label>Jenis</label><select name="type" defaultValue={p.type}><option value="newspaper">Koran</option><option value="magazine">Majalah</option></select></div>
            <div className="field"><label>Frekuensi</label><input type="text" name="frequency" defaultValue={p.settings?.frequency ?? ''} /></div>
          </div>
          <div className="field"><label>Semboyan</label><input type="text" name="tagline" defaultValue={p.tagline ?? ''} /></div>
          <div className="field"><label>Deskripsi</label><textarea name="description" defaultValue={p.description ?? ''} style={{ fontFamily: 'inherit', minHeight: 70 }} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="field"><label>Kota</label><input type="text" name="city" defaultValue={p.city ?? ''} /></div>
            <div className="field"><label>Harga</label><input type="text" name="price" defaultValue={p.settings?.price ?? ''} /></div>
            <div className="field"><label>Keterangan kop</label><input type="text" name="motto" defaultValue={p.settings?.motto ?? ''} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm mb-4"><input type="checkbox" name="is_active" defaultChecked={p.is_active} className="accent-[var(--gold)]" /> Aktif (tampil di aplikasi pembaca)</label>
          <button className="btn gold">Simpan</button>
        </form>

        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--line)] font-display text-lg">Tim redaksi ({ms.length})</div>
            <table className="tbl">
              <thead><tr><th>Nama</th><th>Peran</th><th></th></tr></thead>
              <tbody>
                {ms.map(m => (
                  <tr key={m.id}>
                    <td><div className="font-medium">{m.profiles?.full_name || '—'}</div><div className="text-xs text-[var(--muted)]">{m.profiles?.email} · sejak {formatDate(m.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div></td>
                    <td><RoleSelect value={m.role} action={updateMemberRole.bind(null, m.id)} back={back} /></td>
                    <td className="text-right"><form action={removeMember.bind(null, m.id, back)}><button className="text-xs text-[#f1b1a6] hover:underline">Keluarkan</button></form></td>
                  </tr>
                ))}
                {ms.length === 0 && <tr><td colSpan={3} className="text-center text-[var(--muted)] py-6">Belum ada anggota.</td></tr>}
              </tbody>
            </table>
          </div>
          <form action={addMember} className="card p-5">
            <input type="hidden" name="publication_id" value={id} /><input type="hidden" name="back" value={back} />
            <h2 className="font-display text-lg mb-1">Tambah anggota</h2>
            <p className="text-xs text-[var(--muted)] mb-3">Bila surel sudah terdaftar, akun yang ada akan ditugaskan. Bila belum, isi kata sandi untuk membuat akun baru.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Nama lengkap</label><input type="text" name="full_name" required /></div>
              <div className="field"><label>Surel</label><input type="email" name="email" required placeholder="nama@sekolah.sch.id" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Kata sandi (akun baru)</label><input type="text" name="password" placeholder="min. 6 karakter" /></div>
              <div className="field"><label>Peran</label><select name="role" defaultValue="journalist">{roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
            </div>
            <button className="btn gold">Tambahkan</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
