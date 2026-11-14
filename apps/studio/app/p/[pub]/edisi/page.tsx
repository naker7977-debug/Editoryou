import Link from 'next/link';
import { requirePub } from '@/lib/pub';
import { createClient } from '@press/db/server';
import { EDITION_STATUS_LABEL, canLayoutIn, formatDate, type Edition } from '@press/db';
import { createEdition } from '@/lib/actions';
import { PageThumb, normalizeEdition } from '@press/ui';

export const dynamic = 'force-dynamic';

export default async function Editions({ params }: { params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const { pub, role } = await requirePub(slug);
  const supabase = await createClient();
  const { data } = await supabase.from('editions').select('id,title,number,edition_date,status,access,published_at,updated_at,cover_data').eq('publication_id', pub.id).order('edition_date', { ascending: false }).order('created_at', { ascending: false });
  const eds = (data ?? []) as unknown as Array<Edition & { cover_data?: unknown }>;
  const layoutOk = canLayoutIn(pub, role);
  const base = `/p/${pub.slug}/edisi`;
  return (
    <div className="p-8 max-w-6xl w-full">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div><div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">Edisi</div><h1 className="font-display text-3xl mt-1">Edisi & tata letak</h1></div>
        {layoutOk && <div className="flex gap-2">
          <form action={createEdition.bind(null, pub, { withTemplate: false })}><button className="btn">＋ Edisi kosong</button></form>
          <form action={createEdition.bind(null, pub, { withTemplate: true })}><button className="btn gold">＋ Edisi dari templat</button></form>
        </div>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {eds.map(e => {
          const cover = e.cover_data ? normalizeEdition(e.cover_data, pub.type) : null;
          return (
            <Link key={e.id} href={`${base}/${e.id}`} className="group">
              <div className="cover rounded-sm overflow-hidden bg-[#e9dfc4]">
                {cover ? <PageThumb edition={{ ...cover, pages: cover.pages.slice(0, 1) }} index={0} /> : <div className="aspect-[560/784] flex items-center justify-center font-garamond italic text-[#6b6157] text-sm px-4 text-center">{e.status === 'published' ? 'Tanpa sampul' : 'Belum diterbitkan'}</div>}
              </div>
              <div className="mt-2 flex items-start gap-2">
                <div className="min-w-0 flex-1"><div className="font-display truncate group-hover:text-[var(--gold)]">{e.number || e.title}</div><div className="text-xs text-[var(--muted)]">{formatDate(e.edition_date, { day: 'numeric', month: 'short', year: 'numeric' })}{e.access === 'subscribers' ? ' · pelanggan' : ''}</div></div>
                <span className={'badge ' + (e.status === 'published' ? 'green' : '')}>{EDITION_STATUS_LABEL[e.status]}</span>
              </div>
            </Link>
          );
        })}
        {eds.length === 0 && <div className="col-span-full text-[var(--muted)]">Belum ada edisi. {layoutOk ? 'Mulai dari templat agar struktur halaman langsung tersedia.' : 'Redaktur/penata letak membuat edisi.'}</div>}
      </div>
    </div>
  );
}
