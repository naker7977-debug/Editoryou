import Link from 'next/link';
import { requirePub } from '@/lib/pub';
import { createClient } from '@press/db/server';
import { ARTICLE_STATUS_LABEL, EDITION_STATUS_LABEL, formatDate, type Article, type Edition } from '@press/db';
import { createArticle, createEdition } from '@/lib/actions';
import { canLayout } from '@press/db';

export const dynamic = 'force-dynamic';

export default async function Overview({ params }: { params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const { pub, role } = await requirePub(slug);
  const supabase = await createClient();
  const [{ data: articles }, { data: editions }, { count: mediaCount }, { count: memberCount }] = await Promise.all([
    supabase.from('articles').select('id,title,status,updated_at,byline,profiles(full_name)').eq('publication_id', pub.id).order('updated_at', { ascending: false }).limit(8),
    supabase.from('editions').select('id,title,number,edition_date,status,access,published_at,updated_at').eq('publication_id', pub.id).order('edition_date', { ascending: false }).limit(6),
    supabase.from('media').select('id', { count: 'exact', head: true }).eq('publication_id', pub.id),
    supabase.from('publication_members').select('id', { count: 'exact', head: true }).eq('publication_id', pub.id),
  ]);
  const arts = (articles ?? []) as unknown as Article[];
  const eds = (editions ?? []) as Edition[];
  const published = eds.filter(e => e.status === 'published').length;
  const layoutOk = role === 'superadmin' || canLayout(role);
  const base = `/p/${pub.slug}`;
  return (
    <div className="p-8 max-w-6xl w-full">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">Ringkasan</div>
          <h1 className="font-display text-3xl mt-1">Meja redaksi {pub.name}</h1>
        </div>
        <div className="flex gap-2">
          <form action={createArticle.bind(null, pub.id, pub.slug)}><button className="btn">✎ Naskah baru</button></form>
          {layoutOk && <form action={createEdition.bind(null, pub, { withTemplate: true })}><button className="btn gold">＋ Edisi baru</button></form>}
        </div>
      </div>
      <div className="grid sm:grid-cols-4 gap-3 mb-8">
        {[['Naskah', arts.length + (arts.length === 8 ? '+' : '')], ['Edisi terbit', published], ['Media', mediaCount ?? 0], ['Anggota', memberCount ?? 0]].map(([l, v]) => (
          <div key={String(l)} className="card p-4"><div className="text-[10px] tracking-[.2em] uppercase text-[var(--muted)]">{l}</div><div className="font-display text-3xl mt-1">{v}</div></div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--line)]"><h2 className="font-display text-lg">Naskah terbaru</h2><Link className="text-xs text-[var(--gold)]" href={`${base}/naskah`}>Semua →</Link></div>
          <ul>
            {arts.map(a => (
              <li key={a.id} className="px-5 py-3 border-b border-[var(--line)] last:border-0 flex items-center gap-3">
                <Link href={`${base}/naskah/${a.id}`} className="flex-1 min-w-0"><div className="truncate font-medium">{a.title || '(tanpa judul)'}</div><div className="text-xs text-[var(--muted)]">{a.profiles?.full_name || a.byline || '—'} · {formatDate(a.updated_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></Link>
                <span className={'badge ' + (a.status === 'ready' ? 'green' : a.status === 'review' ? '' : a.status === 'published' ? 'green' : '')}>{ARTICLE_STATUS_LABEL[a.status]}</span>
              </li>
            ))}
            {arts.length === 0 && <li className="px-5 py-6 text-sm text-[var(--muted)]">Belum ada naskah. Mulai dengan “Naskah baru”.</li>}
          </ul>
        </section>
        <section className="card">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--line)]"><h2 className="font-display text-lg">Edisi</h2><Link className="text-xs text-[var(--gold)]" href={`${base}/edisi`}>Semua →</Link></div>
          <ul>
            {eds.map(e => (
              <li key={e.id} className="px-5 py-3 border-b border-[var(--line)] last:border-0 flex items-center gap-3">
                <Link href={`${base}/edisi/${e.id}`} className="flex-1 min-w-0"><div className="truncate font-medium">{e.number || e.title}</div><div className="text-xs text-[var(--muted)]">{formatDate(e.edition_date, { day: 'numeric', month: 'long', year: 'numeric' })}{e.access === 'subscribers' ? ' · pelanggan' : ''}</div></Link>
                <span className={'badge ' + (e.status === 'published' ? 'green' : e.status === 'review' ? '' : '')}>{EDITION_STATUS_LABEL[e.status]}</span>
              </li>
            ))}
            {eds.length === 0 && <li className="px-5 py-6 text-sm text-[var(--muted)]">Belum ada edisi.</li>}
          </ul>
        </section>
      </div>
      <section className="card p-5 mt-6 text-sm text-[var(--muted)] leading-relaxed">
        <b className="text-[var(--text)]">Alur kerja:</b> Wartawan/penulis menulis <b className="text-[var(--text)]">Naskah</b> → tandai “Siap Tayang” → Redaktur/Penata letak menyusun <b className="text-[var(--text)]">Edisi</b> dan menautkan naskah ke blok halaman → Pratinjau flipbook → <b className="text-[var(--text)]">Terbitkan</b>. Edisi terbit langsung tampil di aplikasi pembaca; edisi “pelanggan” hanya terbuka bagi pembaca berlangganan.
      </section>
    </div>
  );
}
