import { notFound } from 'next/navigation';
import { sampleMagazine, sampleNewspaper } from '@press/ui';
import { ReaderShell } from '@/components/ReaderShell';

export default async function Demo({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== 'koran' && kind !== 'majalah') notFound();
  const edition = kind === 'koran' ? sampleNewspaper() : sampleMagazine();
  return <ReaderShell edition={edition} backHref="/" backLabel="Kios" />;
}
