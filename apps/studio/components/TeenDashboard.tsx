import Link from 'next/link';
import { createClient } from '@press/db/server';
import { ARTICLE_STATUS_LABEL, EDITION_STATUS_LABEL, ROLE_LABEL, canLayoutIn, formatDate, type Article, type ArticleStatus, type Edition, type Media, type Publication, type PublicationMember } from '@press/db';
import { createArticle, createEdition } from '@/lib/actions';
import { AssetDrop } from './AssetDrop';

const GRADS = [['#7c5cff', '#ff5cc8'], ['#22d3ee', '#7c5cff'], ['#ff8a4c', '#ff5cc8'], ['#14b8a6', '#a3e635'], ['#f59e0b', '#ef4444'], ['#3b82f6', '#22d3ee']];
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function initials(name: string) { const p = name.trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function Avatar({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const [a, b] = GRADS[hash(name) % GRADS.length];
  return <span className={'t-avatar ' + className} style={{ background: `linear-gradient(135deg,${a},${b})`, ...style }} title={name}>{initials(name)}</span>;
}
function ago(d: string) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} hari lalu`;
  return formatDate(d, { day: 'numeric', month: 'short' });
}
const plain = (t: string) => t.replace(/<[^>]+>/g, ' ').replace(/[#*_>`~[\]()]/g, '').replace(/\s+/g, ' ').trim();

const COLS: { key: ArticleStatus; label: string; grad: string }[] = [
  { key: 'draft', label: 'Draf', grad: 'g-draft' },
  { key: 'review', label: 'Dicek Redaktur', grad: 'g-review' },
  { key: 'ready', label: 'Siap Tayang', grad: 'g-ready' },
  { key: 'published', label: 'Terbit', grad: 'g-published' },
];
const EDITION_PROGRESS: Record<string, number> = { draft: 25, review: 50, ready: 75, published: 100, archived: 100 };

export async function TeenDashboard({ pub, role, userId, firstName }: { pub: Publication; role: PublicationMember['role'] | 'superadmin'; userId: string; firstName: string }) {
  const supabase = await createClient();
  const [{ data: a }, { data: m }, { data: mem }, { data: e }, { count: publishedCount }] = await Promise.all([
    supabase.from('articles').select('id,title,kicker,section,status,updated_at,byline,body,author_id,profiles(full_name,email)').eq('publication_id', pub.id).neq('status', 'archived').order('updated_at', { ascending: false }).limit(80),
    supabase.from('media').select('id,url,caption,created_at').eq('publication_id', pub.id).order('created_at', { ascending: false }).limit(4),
    supabase.from('publication_members').select('id,role,user_id,profiles(full_name,email)').eq('publication_id', pub.id).order('created_at'),
    supabase.from('editions').select('id,title,number,edition_date,status,access').eq('publication_id', pub.id).order('edition_date', { ascending: false }).limit(4),
    supabase.from('editions').select('id', { count: 'exact', head: true }).eq('publication_id', pub.id).eq('status', 'published'),
  ]);
  return <TeenDashboardView pub={pub} role={role} userId={userId} firstName={firstName}
    arts={(a ?? []) as unknown as Article[]} media={(m ?? []) as Media[]} members={(mem ?? []) as unknown as PublicationMember[]} eds={(e ?? []) as Edition[]} publishedCount={publishedCount ?? 0} />;
}

export interface TeenData { pub: Publication; role: PublicationMember['role'] | 'superadmin'; userId: string; firstName: string; arts: Article[]; media: Media[]; members: PublicationMember[]; eds: Edition[]; publishedCount: number }

export function TeenDashboardView({ pub, role, userId, firstName, arts, media, members, eds, publishedCount }: TeenData) {
  const base = `/p/${pub.slug}`;
  const layoutOk = canLayoutIn(pub, role);

  const total = arts.length;
  const by = (s: ArticleStatus) => arts.filter(x => x.status === s);
  const done = by('ready').length + by('published').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const latestEd = eds[0];
  const edPct = latestEd ? EDITION_PROGRESS[latestEd.status] ?? 0 : 0;
  const nameOf = (x: Article) => x.profiles?.full_name || x.byline || x.profiles?.email?.split('@')[0] || 'Tim';
  const mine = arts.find(x => x.author_id === userId && (x.status === 'draft' || x.status === 'review')) ?? arts.find(x => x.status === 'draft');
  const R = 40, C = 2 * Math.PI * R;

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px]">
      {/* sapaan */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="t-kicker">Ruang Redaksi · {pub.name}</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Hai {firstName}, siap bikin edisi keren? ✨</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{total ? `${total} tulisan sedang berjalan, ${by('review').length} menunggu dicek redaktur.` : 'Belum ada tulisan — mulai dari ide pertamamu!'}</p>
        </div>
        <div className="flex gap-2">
          <form action={createArticle.bind(null, pub.id, pub.slug)}><button className="btn">✎ Tulis baru</button></form>
          {layoutOk && <form action={createEdition.bind(null, pub, { withTemplate: true })}><button className="btn gold">＋ Edisi baru</button></form>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 xl:grid-cols-12 gap-5">
        {/* Quick stats */}
        <section className="card lg:col-span-3 xl:col-span-4">
          <div className="t-head"><h2>Statistik Cepat</h2><Link className="more" href={`${base}/naskah`}>Detail →</Link></div>
          <div className="p-4 pt-2 grid grid-cols-2 gap-3">
            <div className="t-tile flex flex-col items-center justify-center text-center">
              <div className="l mb-1">Progres Tulisan</div>
              <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${pct}% tulisan siap atau terbit`}>
                <defs><linearGradient id="tring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff5cc8" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
                <circle cx="52" cy="52" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
                <circle cx="52" cy="52" r={R} fill="none" stroke="url(#tring)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 52 52)" />
                <text x="52" y="58" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800">{pct}%</text>
              </svg>
            </div>
            <div className="t-tile flex flex-col justify-between">
              <div className="l">Status Edisi</div>
              <div className="v mt-2">{latestEd ? `${edPct}%` : '—'}</div>
              <div className="text-[11px] text-[var(--muted)] mb-2 truncate">{latestEd ? `${latestEd.number || latestEd.title} · ${EDITION_STATUS_LABEL[latestEd.status]}` : 'Belum ada edisi'}</div>
              <div className="t-bar"><i style={{ width: `${edPct}%` }} /></div>
            </div>
            <div className="t-tile"><div className="v">{total}</div><div className="l">Tulisan aktif</div></div>
            <div className="t-tile"><div className="v">{by('ready').length}</div><div className="l">Siap tayang</div></div>
            <div className="t-tile"><div className="v">{publishedCount}</div><div className="l">Edisi terbit</div></div>
            <div className="t-tile"><div className="v">{members.length}</div><div className="l">Anggota tim</div></div>
          </div>
        </section>

        {/* Galeri */}
        <section className="card lg:col-span-3 xl:col-span-5">
          <div className="t-head"><div><h2>Galeri Foto</h2><div className="text-[11px] text-[var(--muted)]">Seret-lepas foto liputanmu</div></div><Link className="more" href={`${base}/media`}>Semua →</Link></div>
          <div className="p-4 pt-2 grid grid-cols-3 gap-3" style={{ gridTemplateRows: 'repeat(2, 112px)' }}>
            {media.map(x => (
              <Link key={x.id} href={`${base}/media`} className="t-thumb">
                <img src={x.url} alt={x.caption ?? ''} loading="lazy" />
                <div className="cap truncate">{x.caption || 'Foto'}<div className="font-medium opacity-70">{ago(x.created_at)}</div></div>
              </Link>
            ))}
            {Array.from({ length: Math.max(0, 4 - media.length) }).map((_, i) => <div key={'e' + i} className="t-thumb grid place-items-center text-[11px] text-[var(--muted)]">kosong</div>)}
            <div className="row-span-2 col-start-3 row-start-1"><AssetDrop pubId={pub.id} /></div>
          </div>
        </section>

        {/* Tim */}
        <section className="card lg:col-span-6 xl:col-span-3">
          <div className="t-head"><h2>Aktivitas Tim</h2><Link className="more" href={`${base}/tim`}>Tim →</Link></div>
          <div className="px-4 pt-2 flex items-center flex-wrap gap-y-1">
            {members.slice(0, 6).map((x, i) => <Avatar key={x.id} name={x.profiles?.full_name || x.profiles?.email || '?'} style={{ marginLeft: i ? -8 : 0 }} />)}
            {members.length > 6 && <span className="t-avatar" style={{ marginLeft: -8, background: 'rgba(255,255,255,.12)' }}>+{members.length - 6}</span>}
          </div>
          <ul className="p-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
            {arts.slice(0, 4).map(x => (
              <li key={x.id} className="flex gap-2.5 items-start">
                <Avatar name={nameOf(x)} className="!w-7 !h-7 !text-[10px]" />
                <div className="min-w-0 text-xs leading-snug">
                  <b>{nameOf(x).split(' ')[0]}</b> <span className="text-[var(--muted)]">memperbarui</span>{' '}
                  <Link href={`${base}/naskah/${x.id}`} className="font-semibold hover:text-[var(--gold)]">“{x.title || 'tanpa judul'}”</Link>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">{ago(x.updated_at)} · {ARTICLE_STATUS_LABEL[x.status]}</div>
                </div>
              </li>
            ))}
            {arts.length === 0 && <li className="text-xs text-[var(--muted)]">Belum ada aktivitas.</li>}
          </ul>
          {members.length > 0 && <div className="px-4 pb-4 text-[10px] text-[var(--muted)]">{members.map(x => ROLE_LABEL[x.role]).filter((v, i, s) => s.indexOf(v) === i).join(' · ')}</div>}
        </section>

        {/* Kanban */}
        <section className="card lg:col-span-6 xl:col-span-8">
          <div className="t-head"><div><h2>Papan Alur Kerja</h2><div className="text-[11px] text-[var(--muted)]">Dari draf sampai terbit</div></div><Link className="more" href={`${base}/naskah`}>Semua tulisan →</Link></div>
          <div className="p-4 pt-2 grid grid-cols-2 xl:grid-cols-4 gap-3">
            {COLS.map(col => {
              const list = by(col.key);
              return (
                <div key={col.key} className="t-col">
                  <h3>{col.label}<span className="n">{list.length}</span></h3>
                  {list.slice(0, 4).map(x => (
                    <Link key={x.id} href={`${base}/naskah/${x.id}`} className={'t-card ' + col.grad}>
                      <span className="tag">{x.kicker || x.section || 'Artikel'}</span>
                      <div className="ttl">{x.title || '(tanpa judul)'}</div>
                      <div className="who"><Avatar name={nameOf(x)} />{nameOf(x).split(' ')[0]} · {ago(x.updated_at)}</div>
                    </Link>
                  ))}
                  {list.length > 4 && <Link href={`${base}/naskah`} className="t-add">+{list.length - 4} lainnya</Link>}
                  {col.key === 'draft' && <form action={createArticle.bind(null, pub.id, pub.slug)}><button className="t-add w-full">＋ Tambah tulisan</button></form>}
                  {list.length === 0 && col.key !== 'draft' && <div className="text-[11px] text-[var(--muted)] px-1 py-2">Kosong</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Lanjut menulis + edisi */}
        <section className="card lg:col-span-6 xl:col-span-4 flex flex-col">
          <div className="t-head"><h2>Lanjut Menulis</h2>{mine && <span className="more">{plain(mine.body).split(' ').filter(Boolean).length} kata</span>}</div>
          <div className="p-4 pt-2 flex-1 flex flex-col gap-4">
            {mine ? (
              <Link href={`${base}/naskah/${mine.id}`} className="t-editor block hover:border-[rgba(255,92,200,.45)]">
                <div className="bar" aria-hidden><b>B</b><i>I</i><u>U</u><span>H</span><span>“”</span><span>🔗</span><span className="ml-auto text-[10px] font-semibold">{ARTICLE_STATUS_LABEL[mine.status]}</span></div>
                <div className="doc"><h3>{mine.title || 'Tanpa judul'}<span className="t-caret" /></h3><p>{plain(mine.body) || 'Belum ada isi — klik untuk mulai menulis.'}</p></div>
              </Link>
            ) : (
              <form action={createArticle.bind(null, pub.id, pub.slug)} className="t-editor"><div className="doc"><h3>Ide baru?<span className="t-caret" /></h3><p>Tulis liputan, opini, atau cerita sekolahmu.</p><button className="btn gold mt-3">✎ Mulai menulis</button></div></form>
            )}
            <div>
              <div className="text-xs font-bold mb-2">Edisi terbaru</div>
              <ul className="space-y-1.5">
                {eds.map(x => (
                  <li key={x.id}><Link href={`${base}/edisi/${x.id}`} className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 hover:bg-white/5">
                    <span className="flex-1 truncate font-semibold">{x.number || x.title}</span>
                    <span className="text-[var(--muted)]">{formatDate(x.edition_date, { day: 'numeric', month: 'short' })}</span>
                    <span className={'badge ' + (x.status === 'published' ? 'green' : '')}>{EDITION_STATUS_LABEL[x.status]}</span>
                  </Link></li>
                ))}
                {eds.length === 0 && <li className="text-xs text-[var(--muted)]">Belum ada edisi.</li>}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
