import Link from 'next/link';
import { requireSuperadmin } from '@/lib/guard';
import { Shell, H1 } from '@/components/Shell';
import { Flash } from '@/components/Flash';
import { addMember, resetPassword, setGlobalRole } from '@/lib/actions';
import { ROLE_LABEL, type MemberRole, type Profile, type Publication, type PublicationMember } from '@press/db';

export const dynamic = 'force-dynamic';

export default async function Accounts({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; err?: string }> }) {
  const { q, ok, err } = await searchParams;
  const { profile, admin } = await requireSuperadmin();
  const [{ data: members }, { data: pubs }, { data: supers }] = await Promise.all([
    admin.from('publication_members').select('*, profiles(*), publications(id,name,slug,type)').order('created_at', { ascending: false }),
    admin.from('publications').select('id,name,slug,type').order('name'),
    admin.from('profiles').select('*').eq('role', 'superadmin'),
  ]);
  const byUser = new Map<string, { profile: Profile; roles: PublicationMember[] }>();
  for (const m of (members ?? []) as PublicationMember[]) { if (!m.profiles) continue; const e = byUser.get(m.user_id) ?? { profile: m.profiles, roles: [] }; e.roles.push(m); byUser.set(m.user_id, e); }
  let users = Array.from(byUser.values());
  if (q) users = users.filter(u => (u.profile.full_name ?? '').toLowerCase().includes(q.toLowerCase()) || (u.profile.email ?? '').toLowerCase().includes(q.toLowerCase()));
  const roles = Object.keys(ROLE_LABEL) as MemberRole[];
  return (
    <Shell who={profile.email ?? ''}>
      <H1 kicker="Akun redaksi" title="Editor, wartawan & penulis" right={<form method="get"><input className="input" name="q" placeholder="Cari nama / surel…" defaultValue={q ?? ''} style={{ width: 240 }} /></form>} />
      <Flash ok={ok} err={err} />
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <table className="tbl">
              <thead><tr><th>Nama</th><th>Penugasan</th><th>Kata sandi</th></tr></thead>
              <tbody>
                {users.map(({ profile: u, roles: rs }) => (
                  <tr key={u.id}>
                    <td><div className="font-medium">{u.full_name || '—'} {u.role === 'superadmin' && <span className="badge ml-1">Superadmin</span>}</div><div className="text-xs text-[var(--muted)]">{u.email}</div>
                      {u.role !== 'superadmin' && <form action={setGlobalRole.bind(null, u.id, 'superadmin')}><button className="text-[10px] text-[var(--muted)] hover:text-[var(--gold)]">Jadikan superadmin</button></form>}
                      {u.role === 'superadmin' && u.id !== profile.id && <form action={setGlobalRole.bind(null, u.id, 'user')}><button className="text-[10px] text-[var(--muted)] hover:text-[#f1b1a6]">Cabut superadmin</button></form>}
                    </td>
                    <td><div className="flex flex-wrap gap-1">{rs.map(r => <Link key={r.id} href={`/penerbit/${r.publication_id}`} className="badge hover:border-[var(--gold)]">{r.publications?.name} · {ROLE_LABEL[r.role]}</Link>)}</div></td>
                    <td><form action={resetPassword.bind(null, u.id)} className="flex gap-1"><input className="input" name="password" placeholder="sandi baru" style={{ width: 120, padding: '.3rem .5rem', fontSize: '.75rem' }} /><button className="btn sm">Atur</button></form></td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={3} className="text-center text-[var(--muted)] py-8">Belum ada akun redaksi.</td></tr>}
              </tbody>
            </table>
          </div>
          {!!supers?.length && <div className="text-xs text-[var(--muted)]">Superadmin: {(supers as Profile[]).map(s => s.email).join(', ')}</div>}
        </div>
        <form action={addMember} className="card p-5">
          <input type="hidden" name="back" value="/anggota" />
          <h2 className="font-display text-lg mb-1">Akun redaksi baru</h2>
          <p className="text-xs text-[var(--muted)] mb-3">Akun langsung aktif (tanpa konfirmasi surel). Sampaikan surel & kata sandi kepada yang bersangkutan; mereka masuk lewat Studio Redaksi.</p>
          <div className="field"><label>Nama lengkap</label><input type="text" name="full_name" required /></div>
          <div className="field"><label>Surel</label><input type="email" name="email" required placeholder="nama@sekolah.sch.id" /></div>
          <div className="field"><label>Kata sandi</label><input type="text" name="password" placeholder="min. 6 karakter (kosongkan bila akun sudah ada)" /></div>
          <div className="field"><label>Penerbit</label><select name="publication_id" required>{((pubs ?? []) as Publication[]).map(p => <option key={p.id} value={p.id}>{p.name} ({p.type === 'magazine' ? 'majalah' : 'koran'})</option>)}</select></div>
          <div className="field"><label>Peran</label><select name="role" defaultValue="journalist">{roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          <button className="btn gold w-full justify-center" disabled={!pubs?.length}>Buat & tugaskan</button>
          {!pubs?.length && <p className="text-xs text-[#f1b1a6] mt-2">Buat penerbit terlebih dahulu.</p>}
        </form>
      </div>
    </Shell>
  );
}
