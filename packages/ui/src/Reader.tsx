'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flipbook, type FlipbookHandle, type FlipbookState } from './Flipbook';
import { PageThumb } from './Page';
import { ReadMode } from './ReadMode';
import { MOTION_PREF_LABEL, setMotionPref, useMotionPref, type MotionPref } from './Live';
import { fmtDate, type ArticleMap, type EditionData } from './model';

export interface PressReaderProps {
  edition: EditionData;
  articles?: ArticleMap;
  /** Tombol tambahan di baris alat (kanan atas). */
  extraTools?: React.ReactNode;
  initialPage?: number;
}

/** Pembaca lengkap: flipbook + bilah halaman + daftar isi + mode baca + alat (zoom, suara, layar penuh). */
export function PressReader({ edition, articles, extraTools, initialPage }: PressReaderProps) {
  const fb = useRef<FlipbookHandle>(null);
  const [st, setSt] = useState<FlipbookState>({ cur: 0, N: 0, mode: 'spread', pages: edition.pages.length, label: '' });
  const [sound, setSound] = useState(true);
  const [toc, setToc] = useState(false);
  const [read, setRead] = useState<{ p: number; b: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const mag = edition.kind === 'magazine';
  const motion = useMotionPref();
  const hasLive = edition.motion?.enabled !== false && edition.pages.some((p) => !!p.bg?.motion || p.blocks.some((b) => !!b.img?.motion || (b.images ?? []).some((i) => !!i.motion)));
  const cycleMotion = () => { const nx: Record<MotionPref, MotionPref> = { on: 'save', save: 'off', off: 'on' }; setMotionPref(nx[motion]); };

  useEffect(() => { try { setSound(localStorage.getItem('press.sound') !== '0'); } catch { /* noop */ } }, []);
  useEffect(() => { if (initialPage != null) { const t = setTimeout(() => fb.current?.goToPage(initialPage), 120); return () => clearTimeout(t); } }, [initialPage]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (toc || read) return;
      const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); fb.current?.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); fb.current?.prev(); }
      else if (e.key === 'Home') fb.current?.goToPage(0);
      else if (e.key === 'End') fb.current?.goToPage(edition.pages.length - 1);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [toc, read, edition.pages.length]);

  const onRead = useCallback((p: number, b: number) => setRead({ p, b }), []);
  const onChange = useCallback((s: FlipbookState) => setSt(s), []);
  const cycleZoom = () => { const z = zoom >= 2 ? 1 : zoom >= 1.5 ? 2 : 1.5; setZoom(z); fb.current?.setZoom(z); };
  const toggleSound = () => { const v = !sound; setSound(v); try { localStorage.setItem('press.sound', v ? '1' : '0'); } catch { /* noop */ } };
  const fullscreen = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch { /* noop */ } };

  return (
    <div className={'fb-reader' + (mag ? ' mag' : '')}>
      <div className="fb-area">
        <Flipbook ref={fb} edition={edition} articles={articles} sound={sound} onRead={onRead} onChange={onChange} showNav />
        <div className="fb-tools">
          {extraTools}
          <button onClick={() => setToc(true)} title="Daftar isi">☰</button>
          <button onClick={cycleZoom} title="Perbesar">{zoom > 1 ? zoom + '×' : '⌕'}</button>
          <button onClick={toggleSound} title="Suara halaman">{sound ? '🔔' : '🔕'}</button>
          {hasLive && <button onClick={cycleMotion} title={MOTION_PREF_LABEL[motion] + ' — ketuk untuk mengganti'} aria-label={MOTION_PREF_LABEL[motion]} className={'mv-' + motion}>{motion === 'on' ? '✦' : motion === 'save' ? '◐' : '○'}</button>}
          <button onClick={fullscreen} title="Layar penuh">⛶</button>
        </div>
      </div>
      <div className="fb-bar">
        <span className="pi">{st.label}</span>
        <div className="dots">{Array.from({ length: st.N + 1 }, (_, k) => <i key={k} className={k === st.cur ? 'on' : ''} onClick={() => fb.current?.flipTo(k)} />)}</div>
        <span className="hint2" style={{ opacity: .5, fontSize: 12 }}>seret / ketuk tepi untuk membalik · ketuk tulisan untuk membaca</span>
      </div>
      {toc && (
        <div className={'fb-toc' + (mag ? ' mag' : '')}>
          <button className="closex" onClick={() => setToc(false)}>×</button>
          <h2>{edition.masthead.name}</h2>
          <div className="sub">{edition.masthead.number} · {fmtDate(edition.masthead.date)}</div>
          <div className="thumbs">
            {edition.pages.map((p, i) => (
              <div className="th" key={p.id} onClick={() => { setToc(false); fb.current?.goToPage(i); }}>
                <div className="frame"><PageThumb edition={edition} index={i} articles={articles} /></div>
                <div className="lb">{i + 1} · {p.section}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {read && <ReadMode edition={edition} articles={articles} pageIndex={read.p} blockIndex={read.b} onClose={() => setRead(null)} onNavigate={(p, b) => setRead({ p, b })} />}
    </div>
  );
}
