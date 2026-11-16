'use client';
import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_MOTION, posterOf, type BlockImage, type BlockMotion, type EditionMotion } from './model';
import { imgSrc } from './svgArt';

/* ============================================================
   Foto hidup — gambar yang bergerak di halaman koran/majalah.
   - Berkas video: diputar berulang tanpa suara saat halamannya terbuka.
   - YouTube: sampul diam + tombol putar (atau berulang tanpa suara).
   - Hanya halaman yang sedang terlihat yang memutar; pembaca bisa memilih
     "Gerak aktif / Hemat data / Mati".
   ============================================================ */

export type MotionPref = 'on' | 'save' | 'off';
export const MOTION_PREF_LABEL: Record<MotionPref, string> = { on: 'Foto hidup: aktif', save: 'Foto hidup: hemat data (ketuk untuk putar)', off: 'Foto hidup: mati' };
const KEY = 'press.motion';
const subs = new Set<() => void>();
function readPref(): MotionPref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'on' || v === 'save' || v === 'off') return v;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return 'save';
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'save';
  } catch { /* SSR / privat */ }
  return 'on';
}
export function setMotionPref(v: MotionPref) { try { localStorage.setItem(KEY, v); } catch { /* noop */ } subs.forEach((f) => f()); }
export function useMotionPref(): MotionPref {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, readPref, () => 'on');
}

interface LiveState { live: boolean | 'preview'; settings: EditionMotion }
export const LiveCtx = createContext<LiveState>({ live: false, settings: DEFAULT_MOTION });

/** Hentikan pointerdown agar ketukan pada tombol tidak membalik halaman flipbook. */
function useStopPointer<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop); el.addEventListener('pointerup', stop); el.addEventListener('click', stop);
    return () => { el.removeEventListener('pointerdown', stop); el.removeEventListener('pointerup', stop); el.removeEventListener('click', stop); };
  }, []);
  return ref;
}

/** Gambar sebuah slot. Bila slot punya `motion`, foto hidup ditumpuk di atas gambar diamnya. */
export function Media({ im, alt, mag }: { im?: BlockImage | null; alt?: string; mag: boolean }) {
  const { live, settings } = useContext(LiveCtx);
  const poster = imgSrc(posterOf(im), mag);
  const still = poster ? <img src={poster} alt={alt || ''} draggable={false} /> : null;
  const m = im?.motion;
  if (!m || !m.src || !settings.enabled) return still;
  return (<>{still}{live && <LiveLayer m={m} poster={poster} alt={alt} settings={settings} preview={live === 'preview'} />}</>);
}

function LiveLayer({ m, poster, alt, settings, preview }: { m: BlockMotion; poster: string | null; alt?: string; settings: EditionMotion; preview?: boolean }) {
  const pref = useMotionPref();
  const box = useRef<HTMLSpanElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [seen, setSeen] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [loud, setLoud] = useState(false);
  const btn = useStopPointer<HTMLButtonElement>();
  const snd = useStopPointer<HTMLButtonElement>();

  const filter = m.filter ?? settings.filter ?? 'none';
  const play = m.play ?? settings.play ?? 'auto';
  // pratinjau editor: selalu bergerak tanpa suara agar redaksi melihat hasilnya
  const auto = preview || (play === 'auto' && pref === 'on');
  const running = seen && (auto || tapped);

  useEffect(() => {
    const el = box.current; if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting && e.intersectionRatio > 0.15), { threshold: [0, 0.15, 0.5] });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    const v = vid.current; if (!v) return;
    if (running) { v.muted = !loud; const p = v.play(); if (p) p.catch(() => { /* autoplay ditolak: tetap poster */ }); }
    else v.pause();
  }, [running, loud]);
  useEffect(() => { if (!seen) { setTapped(false); setLoud(false); } }, [seen]);

  if (pref === 'off' && !preview) return null;
  const cls = 'lv f-' + filter + (running ? ' run' : '');
  const start = () => { setTapped(true); if (m.sound) setLoud(true); };

  let layer: React.ReactNode = null;
  if (m.kind === 'file') {
    layer = <video ref={vid} className="lv-m" src={running ? m.src : undefined} poster={poster ?? undefined} muted={!loud} loop playsInline preload="none" aria-label={alt || 'Foto hidup'} />;
  } else if (running) {
    const q = new URLSearchParams({ autoplay: '1', mute: loud ? '0' : '1', loop: '1', playlist: m.src, controls: loud ? '1' : '0', modestbranding: '1', playsinline: '1', rel: '0', ...(m.start ? { start: String(m.start) } : {}) });
    layer = <iframe className={'lv-m' + (loud ? ' interactive' : '')} src={`https://www.youtube-nocookie.com/embed/${m.src}?${q}`} title={alt || 'Video YouTube'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />;
  } else if (poster) {
    layer = <img className="lv-m" src={poster} alt="" draggable={false} />;
  }

  return (
    <span ref={box} className={cls}>
      {layer}
      {!running && seen && (
        <button ref={btn} type="button" className="lv-play" aria-label="Putar foto hidup" onClick={start}><span>▶</span></button>
      )}
      {running && m.sound && !loud && (
        <button ref={snd} type="button" className="lv-snd" aria-label="Nyalakan suara" onClick={() => setLoud(true)}>🔇</button>
      )}
      {running && !loud && <span className="lv-dot" aria-hidden>●</span>}
    </span>
  );
}
