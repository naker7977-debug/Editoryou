import { requirePub } from '@/lib/pub';
import { createClient } from '@press/db/server';
import { ROLE_LABEL, formatDate, type PublicationMember } from '@press/db';

export const dynamic = 'force-dynamic';

export default async function Team({ params }: { params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const { pub } = await requirePub(slug);
  const supabase = await createClient();
  const { data } = await supabase.from('publication_members').select('*, profiles(*)').eq('publication_id', pub.id).order('created_at');
  const members = (data ?? []) as PublicationMember[];
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
  return (
    <div className="p-8 max-w-4xl w-full">
      <div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">Tim</div>
      <h1 className="font-display text-3xl mt-1 mb-2">Tim redaksi {pub.name}</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Akun dan peran anggota dikelola oleh admin platform{adminUrl ? <> di <a className="underline" href={adminUrl} target="_blank" rel="noreferrer">panel admin</a></> : ''}.</p>
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Nama</th><th>Surel</th><th>Peran</th><th>Bergabung</th></tr></thead>
          <tbody>
            {members.map(m => <tr key={m.id}><td className="font-medium">{m.profiles?.full_name || '—'}</td><td className="text-[var(--muted)]">{m.profiles?.email}</td><td><span className="badge">{ROLE_LABEL[m.role]}</span></td><td className="text-[var(--muted)]">{formatDate(m.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="card p-5 mt-6 text-sm text-[var(--muted)] leading-relaxed">
        <b className="text-[var(--text)]">Peran:</b> <b>Pemimpin Redaksi</b> — semua hak termasuk pengaturan penerbit · <b>Redaktur</b> — menata halaman, menerbitkan, menyunting semua naskah · <b>Penata Letak</b> — menata halaman tanpa menerbitkan · <b>Wartawan / Penulis</b> — menulis & mengelola naskah sendiri.
      </div>
    </div>
  );
}
