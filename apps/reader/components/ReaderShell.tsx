'use client';
import Link from 'next/link';
import { PressReader, type EditionData } from '@press/ui';

export function ReaderShell({ edition, backHref, backLabel }: { edition: EditionData; backHref: string; backLabel?: string }) {
  return (
    <div className="h-[calc(100dvh-52px)]">
      <PressReader edition={edition} extraTools={<Link href={backHref} className="inline-flex items-center rounded-md border border-gold/40 bg-[rgba(30,24,20,.75)] px-3 py-1.5 text-[13px] text-[#e9dcc0] hover:bg-gold/20">‹ {backLabel ?? 'Kembali'}</Link>} />
    </div>
  );
}
