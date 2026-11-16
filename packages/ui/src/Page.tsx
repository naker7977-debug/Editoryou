'use client';
import React, { useEffect, useMemo, useRef } from 'react';
import { DEFAULT_MOTION, clamp, fmtDate, paras, posterOf, resolveBlock, type ArticleMap, type Block, type EditionData } from './model';
import { LiveCtx, Media } from './Live';

export interface PageViewProps {
  edition: EditionData;
  index: number;
  articles?: ArticleMap;
  edit?: boolean;
  selected?: number | null;
  onBlockClick?: (bi: number | null) => void;
  /** Dipanggil setelah pengukuran luapan teks (indeks blok yang meluap). */
  onOverflow?: (indices: number[]) => void;
  className?: string;
  style?: React.CSSProperties;
  /** Foto hidup boleh bergerak di halaman ini (halaman yang sedang terlihat); 'preview' = editor. */
  live?: boolean | 'preview';
}

/** Ukur blok yang teksnya tidak muat; tandai kelas .over. Mengembalikan indeks blok. */
export function markOverflow(pgEl: HTMLElement): number[] {
  const res: number[] = [];
  pgEl.querySelectorAll<HTMLElement>('.blk').forEach((blk) => {
    const bw = blk.querySelector<HTMLElement>('.bodyw');
    let over = false;
    if (bw) { const b = bw.firstElementChild as HTMLElement | null; over = !!b && (b.scrollHeight > bw.clientHeight + 3 || b.scrollWidth > bw.clientWidth + 3); }
    else if (['t-quote', 't-ad', 't-toc', 't-brief'].some((c) => blk.classList.contains(c))) over = blk.scrollHeight > blk.clientHeight + 3;
    blk.classList.toggle('over', over);
    if (over) res.push(Number(blk.dataset.bi));
  });
  return res;
}

const EMPTY: ArticleMap = {};

export function PageView({ edition, index, articles = EMPTY, edit, selected, onBlockClick, onOverflow, className, style, live = false }: PageViewProps) {
  const liveVal = useMemo(() => ({ live, settings: { ...DEFAULT_MOTION, ...(edition.motion ?? {}) } }), [live, edition.motion]);
  const ref = useRef<HTMLDivElement>(null);
  const page = edition.pages[index];
  const mag = edition.kind === 'magazine';
  const { theme, masthead } = edition;
  const mh = theme.mastheadStyle === 'serif' ? 'mh-serif' : theme.mastheadStyle === 'caps' ? 'mh-caps' : theme.mastheadStyle === 'modern' ? 'mh-modern' : '';
  const total = edition.pages.length;

  useEffect(() => {
    if (!ref.current) return;
    const run = () => { if (ref.current) { const r = markOverflow(ref.current); onOverflow?.(r); } };
    run();
    let cancelled = false;
    try { (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(() => { if (!cancelled) run(); }); } catch { /* noop */ }
    return () => { cancelled = true; };
  });

  if (!page) return null;
  const fullBleed = page.blocks.some((b) => (b.type === 'cover' || b.type === 'feature') && b.w >= 12 && b.h >= 12);
  const dark = !!page.dark || !!posterOf(page.bg);
  const cls = ['pg', mag ? 'mag' : 'news', 'tone-' + (theme.tone || (mag ? 'bright' : 'ivory')), edit ? 'edit' : '', posterOf(page.bg) ? 'hasbg' : '', dark ? 'dark' : '', fullBleed ? 'bleedpage' : '', className || ''].filter(Boolean).join(' ');
  const bg = posterOf(page.bg);

  return (
    <LiveCtx.Provider value={liveVal}>
    <div ref={ref} className={cls} style={{ ['--p-accent' as string]: theme.accent || '#8b1e1e', ...style }}
      onClick={edit && onBlockClick ? (e) => { const t = (e.target as HTMLElement).closest('.blk') as HTMLElement | null; onBlockClick(t ? Number(t.dataset.bi) : null); } : undefined}>
      {bg && <div className="pgbg"><Media im={page.bg} mag={mag} /></div>}
      {!mag && index === 0 && !fullBleed && (
        <div className={'masthead ' + mh}>
          <div className="ears">
            <span><b>{masthead.price}</b>{masthead.motto}</span>
            <span style={{ textAlign: 'right' }}><b>{masthead.number}</b>{masthead.city}</span>
          </div>
          <div className="name">{masthead.name}</div>
          {masthead.tagline && <div className="tag">{masthead.tagline}</div>}
          <div className="meta"><span>{fmtDate(masthead.date)}</span><span>{page.section || 'Utama'}</span><span>Halaman 1 dari {total}</span></div>
        </div>
      )}
      {!mag && index > 0 && (
        <div className={'pghead ' + mh}><span className="pn">{index + 1}</span><span className="nm">{masthead.name}</span><span>{page.section}</span></div>
      )}
      {mag && !fullBleed && (
        <div className="mhead"><span className="nm">{masthead.name}</span><span>{page.section}</span><span>{masthead.number}</span></div>
      )}
      <div className="grid">
        {!page.blocks.length && <div className="empty">{edit ? 'Halaman kosong — tambahkan blok atau pilih preset' : ''}</div>}
        {page.blocks.map((raw, bi) => <BlockView key={raw.id} b={resolveBlock(raw, articles)} bi={bi} sel={!!edit && selected === bi} edition={edition} />)}
      </div>
      {!mag && !fullBleed && <div className="pgfoot"><span>{masthead.name}</span><span>{page.section} · {index + 1}</span><span>{fmtDate(masthead.date)}</span></div>}
      {mag && !fullBleed && <div className="mfoot"><span>{masthead.tagline || masthead.number}</span><span className="pn">{index + 1}</span></div>}
    </div>
    </LiveCtx.Provider>
  );
}


function BlockView({ b, bi, sel, edition }: { b: Block; bi: number; sel: boolean; edition: EditionData }) {
  const mag = edition.kind === 'magazine';
  const w = clamp(b.w || 4, 1, 12), h = clamp(b.h || 4, 1, 12);
  const textual = ['lead', 'article', 'brief', 'text'].includes(b.type);
  const cls = ['blk', 't-' + b.type, 'w' + w, 'h' + h, 's-' + (b.scale || 'm'), sel ? 'sel' : '', b.invert ? 'onphoto' : ''];
  if (b.dropcap && ['lead', 'article', 'text'].includes(b.type)) cls.push('dc');
  if (['lead', 'article', 'brief', 'text', 'quote', 'feature'].includes(b.type)) cls.push('readable');
  if (posterOf(b.img) && textual) cls.push('hasimg');
  const placed = b.x != null && b.y != null;
  const x = placed ? clamp(b.x!, 0, 12 - w) : 0, y = placed ? clamp(b.y!, 0, 11) : 0;
  const style: React.CSSProperties = placed
    ? { gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${Math.min(h, 12 - y)}`, zIndex: bi + 1 }
    : { gridColumn: `span ${w}`, gridRow: `span ${h}` };
  const ms = edition.masthead;

  let inner: React.ReactNode;
  switch (b.type) {
    case 'quote':
      inner = <div className="cin"><div className="q">{b.body || '…'}</div>{b.byline && <div className="src">{b.byline}</div>}</div>;
      break;
    case 'ad': {
      const src = posterOf(b.img);
      inner = (<>
        <div className="lbl">Iklan</div>
        <div className="cin">
          {src && <div className="fig" style={{ height: Math.round(h * 22) }}><div className="imw" style={{ height: '100%' }}><Media im={b.img} mag={mag} /></div></div>}
          <div className={'ttl' + (w < 4 || h < 3 ? ' sm' : '')}>{b.title}</div>
          {b.body && <div className="adb">{b.body}</div>}
          {b.byline && <div className="adc">{b.byline}</div>}
        </div>
      </>);
      break;
    }
    case 'image':
      inner = (
        <div className="fig">
          <div className="imw">{posterOf(b.img) || b.img?.motion ? <Media im={b.img} alt={b.cap} mag={mag} /> : <div className="noimg">Foto belum dipilih</div>}</div>
          {(b.title || b.cap) && <div className="cap">{b.title && <b>{b.title} </b>}{b.cap}</div>}
        </div>
      );
      break;
    case 'gallery': {
      const imgs = (b.images ?? []).slice(0, 4);
      inner = (<>
        <div className={'gg n' + Math.max(1, imgs.length)}>{imgs.length ? imgs.map((im, i) => <div className="gi" key={i}><Media im={im} mag={mag} /></div>) : <div className="noimg">Tambahkan 2–4 foto</div>}</div>
        {(b.title || b.cap) && <div className="cap">{b.title && <b>{b.title} </b>}{b.cap}</div>}
      </>);
      break;
    }
    case 'cover': {
      const lines = (ms.coverLines ?? []).filter(Boolean);
      inner = (<>
        <Media im={b.img} alt={b.title} mag={mag} />
        <div className="shade" />
        <div className="mtop"><span>{ms.number}</span><span>{fmtDate(ms.date)}</span></div>
        <div className={'mname ' + (edition.theme.mastheadStyle === 'modern' ? 'sans' : edition.theme.mastheadStyle === 'caps' ? 'caps' : '')}>{ms.name}</div>
        {lines.length > 0 && <div className="clines">{lines.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}</div>}
        <div className="mbot">
          {b.kicker && <div className="ck">{b.kicker}</div>}
          <div className="ct">{b.title || ms.tagline}</div>
          {b.deck && <div className="cd">{b.deck}</div>}
        </div>
        <div className="cbar"><span>{ms.tagline}</span><span>{ms.price}</span></div>
      </>);
      break;
    }
    case 'feature':
      inner = (<>
        <Media im={b.img} alt={b.title} mag={mag} />
        <div className="shade" />
        <div className="fbot">
          {b.kicker && <div className="kick">{b.kicker}</div>}
          <h2 className="ttl">{b.title}</h2>
          {b.deck && <p className="deck">{b.deck}</p>}
          {b.byline && <div className="by"><b>Oleh </b>{b.byline}</div>}
        </div>
      </>);
      break;
    case 'toc': {
      const rows: { n: number; s: string; t: string; d: string }[] = [];
      edition.pages.forEach((p, i) => {
        if (p.blocks.some((x) => x.type === 'cover' || x.type === 'toc')) return;
        const lead = p.blocks.find((x) => ['feature', 'lead', 'article', 'text', 'brief'].includes(x.type) && x.title);
        if (lead) rows.push({ n: i + 1, s: p.section, t: lead.title || '', d: lead.deck || lead.byline || '' });
      });
      inner = (<>
        <div className="th"><small>{ms.number} · {fmtDate(ms.date)}</small>{b.title || 'Daftar Isi'}</div>
        {rows.slice(0, 9).map((r) => <div className="row" key={r.n}><div className="n">{r.n}</div><div><div className="s">{r.s}</div><div className="t">{r.t}</div>{r.d && <div className="d">{r.d}</div>}</div></div>)}
      </>);
      break;
    }
    default: {
      const ih = b.imgH === 's' ? 0.2 : b.imgH === 'l' ? 0.46 : 0.32;
      const ps = paras(b.body);
      const src = posterOf(b.img);
      inner = (<>
        {b.kicker && <div className="kick">{b.kicker}</div>}
        {b.title && <h2 className="ttl">{b.title}</h2>}
        {b.deck && <p className="deck">{b.deck}</p>}
        {b.byline && <div className="by"><b>Oleh </b>{b.byline}</div>}
        {src && (
          <div className="fig flex" style={{ height: Math.round(h * (784 - 120) / 12 * ih) }}>
            <div className="imw"><Media im={b.img} alt={b.cap || b.title || ''} mag={mag} /></div>
            {b.cap && <div className="cap"><b>Foto </b>{b.cap}</div>}
          </div>
        )}
        <div className="bodyw"><div className="body" style={{ columnCount: clamp(b.cols || 1, 1, 4) }}>{ps.map((p, i) => <p key={i}>{p}</p>)}</div></div>
        <div className="ovbadge">Teks meluap</div>
      </>);
    }
  }
  return <div className={cls.filter(Boolean).join(' ')} style={style} data-bi={bi}>{inner}</div>;
}

/** Thumbnail halaman yang menyesuaikan lebar pembungkusnya. */
export function PageThumb({ edition, index = 0, articles, className, style, live }: { edition: EditionData; index?: number; articles?: ArticleMap; className?: string; style?: React.CSSProperties; live?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => { const pg = el.querySelector<HTMLElement>('.pg'); if (pg) pg.style.transform = `scale(${el.clientWidth / 560})`; };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className={'pg-thumb ' + (className || '')} style={style}><PageView edition={edition} index={index} articles={articles} live={live} /></div>;
}
