'use client';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { PageView } from './Page';
import { clamp, type ArticleMap, type EditionData } from './model';

export interface FlipbookHandle {
  next(): void; prev(): void; flipTo(sheet: number): void; goToPage(p: number): void; setZoom(z: number): void; getZoom(): number;
}
export interface FlipbookState { cur: number; N: number; mode: 'spread' | 'single'; pages: number; label?: string }
export interface FlipbookProps {
  edition: EditionData;
  articles?: ArticleMap;
  sound?: boolean;
  onRead?: (pageIndex: number, blockIndex: number) => void;
  onChange?: (s: FlipbookState) => void;
  showNav?: boolean;
}

/** Flipbook 3D: lembar dapat diseret/diketuk untuk dilipat; dua halaman berhadapan di layar lebar, satu halaman di ponsel. */
export const Flipbook = forwardRef<FlipbookHandle, FlipbookProps>(function Flipbook({ edition, articles, sound = true, onRead, onChange, showNav = false }, ref) {
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'spread' | 'single'>('spread');
  const [cur, setCur] = useState(0);
  const [zoom, setZoomState] = useState(1);
  const [ready, setReady] = useState(false);
  const curRef = useRef(0); curRef.current = cur;
  const busyRef = useRef(false);
  const scaleRef = useRef(1);
  const acRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound); soundRef.current = sound;
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;

  const n = edition.pages.length;
  const N = mode === 'single' ? n : Math.ceil(n / 2);
  const sheets = () => Array.from(bookRef.current?.querySelectorAll<HTMLElement>('.fb-sheet') ?? []);

  const detectMode = useCallback((): 'spread' | 'single' => {
    const r = stageRef.current?.getBoundingClientRect(); if (!r || !r.width) return 'spread';
    return r.width < 720 || r.width / r.height < 0.95 ? 'single' : 'spread';
  }, []);

  const playSound = useCallback((v = 1) => {
    if (!soundRef.current) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AC) return;
      acRef.current = acRef.current || new AC();
      const ac = acRef.current; if (ac.state === 'suspended') ac.resume();
      const dur = .42, sr = ac.sampleRate, buf = ac.createBuffer(1, sr * dur, sr), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const t = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * t), 1.6) * (1 - t * .4); }
      const src = ac.createBufferSource(); src.buffer = buf;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = .7;
      const g = ac.createGain(); g.gain.value = .11 * v;
      src.connect(bp).connect(g).connect(ac.destination); src.start();
    } catch { /* audio tidak tersedia */ }
  }, []);

  const updateShift = useCallback((c: number) => {
    const s = scaleRef.current; let shift = 0;
    if (mode === 'spread' && zoom <= 1) { if (c === 0) shift = -280; else if (c === N) shift = 280; }
    if (bookRef.current) bookRef.current.style.transform = `translateX(${shift * s}px) scale(${s})`;
  }, [mode, zoom, N]);

  const layout = useCallback(() => {
    const st = stageRef.current, wrap = wrapRef.current; if (!st || !wrap) return;
    const r = st.getBoundingClientRect(); if (!r.width || !r.height) return;
    const bw = mode === 'single' ? 560 : 1120, pad = mode === 'single' ? 16 : 70;
    const s = Math.max(0.1, Math.min((r.width - pad * 2) / bw, (r.height - 36) / 784) * zoom);
    scaleRef.current = s;
    wrap.style.width = bw * s + 'px'; wrap.style.height = 784 * s + 'px';
    updateShift(curRef.current);
  }, [mode, zoom, updateShift]);

  const applyAll = useCallback((c: number) => {
    const shs = sheets();
    shs.forEach((sh, k) => {
      const flipped = k < c;
      sh.classList.remove('anim');
      sh.style.transform = flipped ? 'rotateY(-180deg)' : 'rotateY(0deg)';
      sh.style.zIndex = String(flipped ? k + 1 : shs.length - k + 1);
      sh.classList.toggle('gone', mode === 'single' && flipped);
      sh.querySelectorAll<HTMLElement>('.face').forEach((f) => f.style.setProperty('--sh', '0'));
    });
    const b = bookRef.current;
    if (b) {
      const sl = b.querySelector<HTMLElement>('.fb-stack.l'), sr = b.querySelector<HTMLElement>('.fb-stack.r');
      if (sr) sr.style.visibility = c < shs.length - 1 ? 'visible' : 'hidden';
      if (sl) sl.style.visibility = c > 1 ? 'visible' : 'hidden';
    }
    updateShift(c);
  }, [mode, updateShift]);

  useLayoutEffect(() => {
    const st = stageRef.current; if (!st) return;
    const onR = () => {
      const m = detectMode();
      if (m !== mode) {
        const page = mode === 'single' ? curRef.current : Math.max(0, curRef.current * 2 - 1);
        const nc = m === 'single' ? clamp(page, 0, n) : clamp(Math.ceil(page / 2), 0, Math.ceil(n / 2));
        curRef.current = nc; setCur(nc); setMode(m);
      } else layout();
    };
    onR();
    const ro = new ResizeObserver(onR); ro.observe(st);
    return () => ro.disconnect();
  }, [mode, n, detectMode, layout]);

  useLayoutEffect(() => { layout(); applyAll(cur); const t = setTimeout(() => setReady(true), 50); return () => clearTimeout(t); }, [mode, cur, zoom, n, layout, applyAll]);

  useEffect(() => {
    const label = !n ? '' : mode === 'single' ? `Halaman ${Math.min(cur + 1, n)} / ${n}` : cur === 0 ? `Halaman 1 / ${n}` : (cur === N && n % 2 === 0) ? `Halaman ${n} / ${n}` : `Halaman ${cur * 2}–${Math.min(cur * 2 + 1, n)} / ${n}`;
    onChangeRef.current?.({ cur, N, mode, pages: n, label });
  }, [cur, N, mode, n]);

  const flipTo = useCallback((target: number) => {
    target = clamp(target, 0, N);
    const c = curRef.current;
    if (target === c || busyRef.current) return;
    const dir = target > c ? 1 : -1;
    const k = dir > 0 ? c : c - 1;
    const sh = sheets()[k]; if (!sh) return;
    busyRef.current = true;
    sh.classList.add('anim'); sh.style.zIndex = String(N + 5); sh.classList.remove('gone');
    playSound();
    const faces = sh.querySelectorAll<HTMLElement>('.face');
    faces.forEach((f) => f.style.setProperty('--sh', '.55'));
    setTimeout(() => faces.forEach((f) => f.style.setProperty('--sh', '0')), 450);
    let finished = false;
    const done = (e?: Event) => {
      const te = e as TransitionEvent | undefined;
      if (te && (te.target !== sh || te.propertyName !== 'transform')) return;
      if (finished) return; finished = true;
      sh.removeEventListener('transitionend', done);
      busyRef.current = false;
      const nc = c + dir; curRef.current = nc; setCur(nc);
      if (target !== nc) setTimeout(() => flipTo(target), 30);
    };
    sh.addEventListener('transitionend', done);
    setTimeout(() => done(), 900);
    requestAnimationFrame(() => { sh.style.transform = dir > 0 ? 'rotateY(-180deg)' : 'rotateY(0deg)'; });
    updateShift(c + dir);
  }, [N, playSound, updateShift]);

  const goToPage = useCallback((p: number) => {
    const t = mode === 'single' ? clamp(p, 0, N) : clamp(Math.ceil(p / 2), 0, N);
    if (Math.abs(t - curRef.current) > 1) { curRef.current = t; setCur(t); } else flipTo(t);
  }, [mode, N, flipTo]);

  useImperativeHandle(ref, () => ({
    next: () => flipTo(curRef.current + 1), prev: () => flipTo(curRef.current - 1), flipTo, goToPage,
    setZoom: (z) => setZoomState(z), getZoom: () => zoom,
  }), [flipTo, goToPage, zoom]);

  // ---- seret untuk melipat ----
  useEffect(() => {
    const st = stageRef.current; if (!st) return;
    type Drag = { k: number; back: boolean; x0: number; y0: number; sx: number; pw: number; moved: boolean; t0: number; target: HTMLElement; offset: number; th: number };
    let drag: Drag | null = null;
    const spineX = () => { const r = bookRef.current!.getBoundingClientRect(); return mode === 'single' ? r.left : r.left + r.width / 2; };
    const handleTap = (target: HTMLElement, x: number, sx: number, pw: number) => {
      const blk = target.closest('.blk.readable') as HTMLElement | null;
      const rel = (x - sx) / pw;
      if (blk && onRead) {
        const face = blk.closest('.face')!, sh = face.closest('.fb-sheet') as HTMLElement; const k = Number(sh.dataset.i);
        const pi = mode === 'single' ? k : (face.classList.contains('front') ? 2 * k : 2 * k + 1);
        onRead(pi, Number(blk.dataset.bi)); return;
      }
      if (mode === 'single') { if (rel > .5) flipTo(curRef.current + 1); else if (rel >= 0) flipTo(curRef.current - 1); }
      else { if (rel > 0) flipTo(curRef.current + 1); else flipTo(curRef.current - 1); }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || busyRef.current || zoom > 1 || !bookRef.current) return;
      if ((e.target as HTMLElement).closest('.fb-nav,.fb-tools,button,a')) return;
      const sx = spineX(), pw = 560 * scaleRef.current, rel = (e.clientX - sx) / pw;
      if (rel < -1.05 || rel > 1.05) return;
      const c = curRef.current; let k: number, back: boolean;
      if (mode === 'single') { if (rel < 0) return; k = c; back = false; if (k >= N) return; }
      else if (rel >= 0) { k = c; back = false; if (k >= N) return; }
      else { k = c - 1; back = true; if (k < 0) return; }
      drag = { k, back, x0: e.clientX, y0: e.clientY, sx, pw, moved: false, t0: performance.now(), target: e.target as HTMLElement, offset: back ? (-1 - rel) : (1 - rel), th: back ? 180 : 0 };
      const sh = sheets()[k]; sh?.classList.remove('anim'); sh?.classList.remove('gone');
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
      const sh = sheets()[drag.k]; if (!sh) return;
      if (!drag.moved) { drag.moved = true; try { st.setPointerCapture(e.pointerId); } catch { /* noop */ } sh.style.zIndex = String(N + 5); }
      const cth = clamp((e.clientX - drag.sx) / drag.pw + drag.offset, -1, 1);
      const th = Math.acos(cth) * 180 / Math.PI; drag.th = th;
      sh.style.transform = `rotateY(${-th}deg)`;
      const shade = (Math.sin(th * Math.PI / 180) * .6).toFixed(3);
      sh.querySelectorAll<HTMLElement>('.face').forEach((f) => f.style.setProperty('--sh', shade));
    };
    const onUp = (e: PointerEvent) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved) { handleTap(d.target, e.clientX, d.sx, d.pw); return; }
      const sh = sheets()[d.k]; if (!sh) return;
      const quick = performance.now() - d.t0 < 350;
      const complete = !d.back ? (d.th > 70 || (quick && d.th > 25)) : (d.th < 110 || (quick && d.th < 155));
      busyRef.current = true; sh.classList.add('anim'); playSound(complete ? 1 : .4);
      const finalDeg = !d.back ? (complete ? -180 : 0) : (complete ? 0 : -180);
      let finished = false;
      const done = (ev?: Event) => {
        const te = ev as TransitionEvent | undefined;
        if (te && (te.target !== sh || te.propertyName !== 'transform')) return;
        if (finished) return; finished = true;
        sh.removeEventListener('transitionend', done);
        busyRef.current = false;
        const nc = complete ? curRef.current + (d.back ? -1 : 1) : curRef.current;
        curRef.current = nc; setCur(nc); applyAll(nc);
      };
      sh.addEventListener('transitionend', done);
      setTimeout(() => done(), 800);
      requestAnimationFrame(() => { sh.style.transform = `rotateY(${finalDeg}deg)`; sh.querySelectorAll<HTMLElement>('.face').forEach((f) => f.style.setProperty('--sh', '0')); });
      if (complete) updateShift(curRef.current + (d.back ? -1 : 1));
    };
    st.addEventListener('pointerdown', onDown); st.addEventListener('pointermove', onMove);
    st.addEventListener('pointerup', onUp); st.addEventListener('pointercancel', onUp);
    return () => { st.removeEventListener('pointerdown', onDown); st.removeEventListener('pointermove', onMove); st.removeEventListener('pointerup', onUp); st.removeEventListener('pointercancel', onUp); };
  }, [mode, N, zoom, onRead, flipTo, applyAll, playSound, updateShift]);

  const mag = edition.kind === 'magazine';
  const tone = 'tone-' + (edition.theme.tone || (mag ? 'bright' : 'ivory'));
  const blank = <div className={'pg ' + (mag ? 'mag ' : '') + tone} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: 'var(--p-garamond)', fontStyle: 'italic', color: 'var(--p-ink-3)', fontSize: 14, letterSpacing: '.1em' }}>{edition.masthead.name}</div></div>;

  return (
    <div ref={stageRef} className={'fb-stage' + (zoom > 1 ? ' zoomed' : '')}>
      <div ref={wrapRef} className="fb-wrap">
        <div ref={bookRef} className={'fb-book' + (ready ? '' : ' notrans') + (mode === 'single' ? ' single' : '')}>
          <div className="deskshadow" />
          <div className="fb-stack l"><i /><i /><i /></div>
          <div className="fb-stack r"><i /><i /><i /></div>
          {Array.from({ length: N }, (_, k) => {
            const fi = mode === 'single' ? k : 2 * k, bi = mode === 'single' ? -1 : 2 * k + 1;
            // yang terlihat: muka depan lembar `cur` (kanan) dan muka belakang lembar `cur-1` (kiri)
            const frontLive = k === cur, backLive = k === cur - 1;
            return (
              <div className="fb-sheet" data-i={k} key={mode + ':' + k + ':' + (edition.pages[fi]?.id ?? '')}>
                <div className="face front"><PageView edition={edition} index={fi} articles={articles} live={frontLive} /><div className="spine" /><div className="edge" /></div>
                <div className="face back">{bi >= 0 && bi < n ? <PageView edition={edition} index={bi} articles={articles} live={backLive} /> : blank}<div className="spine" /><div className="edge" /></div>
              </div>
            );
          })}
        </div>
      </div>
      {showNav && <>
        <button className="fb-nav prev" aria-label="Halaman sebelumnya" disabled={cur === 0} onClick={() => flipTo(curRef.current - 1)}>‹</button>
        <button className="fb-nav next" aria-label="Halaman berikutnya" disabled={cur === N} onClick={() => flipTo(curRef.current + 1)}>›</button>
      </>}
    </div>
  );
});
