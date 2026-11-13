import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMemberships, getProfile } from '@press/db/server';
import { ROLE_LABEL, type Publication } from '@press/db';
import { createClient } from '@press/db/server';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { user, profile } = await getProfile();
  if (!user) redirect('/masuk');
  const { denied } = await searchParams;
  const memberships = await getMemberships();
  let all: Publication[] = [];
  if (profile?.role === 'superadmin') { const s = await createClient(); const { data } = await s.from('publications').select('*').order('name'); all = (data as Publication[]) ?? []; }
  if (memberships.length === 1 && profile?.role !== 'superadmin' && !denied) redirect(`/p/${memberships[0].publications?.slug}`);

  return (
    <main className="min-h-screen">
      <header className="h-14 flex items-center px-5 border-b border-[var(--line)] bg-[linear-gradient(#1d1915,#17130f)]">
        <span className="font-black text-2xl mr-auto">Studio Redaksi</span>
        <span className="text-sm text-[var(--muted)] mr-3">{profile?.full_name || user.email}</span>
        <form action="/keluar" method="post"><button className="btn sm">Keluar</button></form>
      </header>
      <div className="max-w-4xl mx-auto px-5 py-12">
        {denied && <div className="warnbox mb-6">Anda bukan anggota redaksi penerbit “{denied}”.</div>}
        <div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">Pilih meja redaksi</div>
        <h1 className="font-display text-4xl mt-2 mb-8">Selamat bekerja, {profile?.full_name?.split(' ')[0] || 'Redaksi'}.</h1>
        <div className="grid sm:grid-cols-2 gap-4">
          {memberships.map(m => m.publications && (
            <Link key={m.id} href={`/p/${m.publications.slug}`} className="card p-5 hover:border-[var(--gold)] transition">
              <div className="text-[10px] tracking-[.25em] uppercase text-[var(--gold)] font-semibold">{m.publications.type === 'magazine' ? 'Majalah' : 'Koran'}</div>
              <div className={(m.publications.type === 'magazine' ? 'font-display tracking-[.15em] uppercase' : 'font-black') + ' text-2xl mt-2'}>{m.publications.name}</div>
              <div className="text-sm text-[var(--muted)] mt-2">Peran Anda: <b className="text-[var(--text)]">{ROLE_LABEL[m.role]}</b></div>
            </Link>
          ))}
          {memberships.length === 0 && profile?.role !== 'superadmin' && <div className="card p-6 text-[var(--muted)]">Akun Anda belum ditugaskan ke penerbit mana pun. Hubungi admin platform.</div>}
        </div>
        {profile?.role === 'superadmin' && (
          <>
            <h2 className="font-display text-xl mt-12 mb-4">Semua penerbit <span className="badge ml-2">Superadmin</span></h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {all.map(p => <Link key={p.id} href={`/p/${p.slug}`} className="card p-4 hover:border-[var(--gold)]"><div className="text-[10px] tracking-[.2em] uppercase text-[var(--gold)]">{p.type}</div><div className="font-display text-lg">{p.name}</div></Link>)}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
