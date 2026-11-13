'use client';
import React, { useEffect } from 'react';
import { fmtDate, paras, resolveBlock, words, type ArticleMap, type EditionData } from './model';
import { imgSrc } from './svgArt';

const EMPTY: ArticleMap = {};
/** Tampilan baca satu tulisan penuh (tipografi besar, foto, navigasi antar-tulisan di halaman yang sama). */
export function ReadMode({ edition, pageIndex, blockIndex, articles = EMPTY, onClose, onNavigate }: {
  edition: EditionData; pageIndex: number; blockIndex: number; articles?: ArticleMap; onClose: () => void; onNavigate?: (p: number, b: number) => void;
}) {
  const page = edition.pages[pageIndex]; const raw = page?.blocks[blockIndex];
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  if (!page || !raw) return null;
  const b = resolveBlock(raw, articles);
  const mag = edition.kind === 'magazine';
  const ms = edition.masthead;
  const readable = page.blocks.map((x, i) => ({ x, i })).filter((o) => ['lead', 'article', 'brief', 'text', 'quote', 'feature'].includes(o.x.type));
  const idx = readable.findIndex((o) => o.i === blockIndex);
  const prev = readable[idx - 1], next = readable[idx + 1];
  const ps = paras(b.body); const wc = words(b.body);
  const src = imgSrc(b.img?.url, mag);
  return (
    <div className={'rm' + (mag ? ' mag' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <article className={'sheetp tone-' + (edition.theme.tone || (mag ? 'bright' : 'ivory'))} style={{ ['--p-accent' as string]: edition.theme.accent }}>
        <button className="close" onClick={onClose} aria-label="Tutup">×</button>
        <div className="rm-head"><span>{ms.name}</span><span>{page.section} · Hal. {pageIndex + 1}</span><span>{fmtDate(ms.date)}</span></div>
        {b.type === 'quote' ? (<>
          <div className="kick">Kutipan</div>
          <h1 style={{ fontStyle: 'italic', fontWeight: 400 }}>“{b.body}”</h1>
          {b.byline && <div className="by"><span>— {b.byline}</span></div>}
        </>) : (<>
          {b.kicker && <div className="kick">{b.kicker}</div>}
          <h1>{b.title}</h1>
          {b.deck && <p className="deck">{b.deck}</p>}
          <div className="by"><span>{b.byline ? 'Oleh ' + b.byline : ms.name}</span>{wc > 0 && <span>{wc} kata · {Math.max(1, Math.round(wc / 200))} menit baca</span>}</div>
          {src && <figure><img src={src} alt={b.cap || ''} />{b.cap && <figcaption>{b.cap}</figcaption>}</figure>}
          <div className={'txt' + (wc > 350 ? ' two' : '')}>{ps.map((p, i) => <p key={i} className={i === ps.length - 1 ? 'endmark' : ''}>{p}</p>)}</div>
        </>)}
        {onNavigate && (
          <div className="rm-foot">
            <button disabled={!prev} onClick={() => prev && onNavigate(pageIndex, prev.i)}>‹ Sebelumnya</button>
            <span style={{ alignSelf: 'center' }}>{idx + 1} dari {readable.length} tulisan di halaman ini</span>
            <button disabled={!next} onClick={() => next && onNavigate(pageIndex, next.i)}>Berikutnya ›</button>
          </div>
        )}
      </article>
    </div>
  );
}
