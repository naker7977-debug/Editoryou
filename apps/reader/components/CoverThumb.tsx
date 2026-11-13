'use client';
import { PageThumb, type EditionData } from '@press/ui';

export function CoverThumb({ data, label, sub }: { data: EditionData | null; label: string; sub?: string }) {
  if (!data) {
    return (
      <div className="pg-thumb flex items-center justify-center bg-paper-2 text-ink-3">
        <div className="p-4 text-center font-garamond italic text-sm">{label}{sub ? <><br />{sub}</> : null}</div>
      </div>
    );
  }
  return <PageThumb edition={data} index={0} />;
}
