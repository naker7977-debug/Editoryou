'use client';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { Flipbook, type FlipbookHandle, type FlipbookState, ReadMode, type EditionData, fmtDate } from '@press/ui';

export function PreviewClient({ edition, backHref, status }: { edition: EditionData; backHref: string; status: string }) {
  const book = useRef<FlipbookHandle>(null);
  const [st, setSt] = useState<FlipbookState>({ cur: 0, N: 0, mode: 'spread', pages: edition.pages.length });
  const [read, setRead] = useState<{ pi: number; bi: number } | null>(null);
  const onRead = useCallback((pi: number, bi: number) => setRead({ pi, bi }), []);
  const onChange = useCallback((s: FlipbookState) => setSt(s), []);
  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 flex items-center gap-3 px-4 border-b border-[var(--line)] bg-[linear-gradient(#1d1915,#17130f)] shrink-0">
        <Link href={backHref} className="btn sm">‹ Kembali ke tata letak</Link>
        <span className="font-display">{edition.masthead.name}</span>
        <span className="text-xs text-[var(--muted)]">{edition.masthead.number} · {fmtDate(edition.masthead.date)}</span>
        <span className="badge ml-auto">Pratinjau · {status === 'published' ? 'versi draf' : 'belum terbit'}</span>
      </header>
      <div className="flex-1 min-h-0 relative reader-stage">
        <button className="navbtn prev" onClick={() => book.current?.prev()} disabled={st.cur === 0}>‹</button>
        <button className="navbtn next" onClick={() => book.current?.next()} disabled={st.cur === st.N}>›</button>
        <Flipbook ref={book} edition={edition} onRead={onRead} onChange={onChange} />
      </div>
      {read && <ReadMode edition={edition} pageIndex={read.pi} blockIndex={read.bi} onClose={() => setRead(null)} />}
    </div>
  );
}
