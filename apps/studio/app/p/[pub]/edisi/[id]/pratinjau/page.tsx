import { notFound } from 'next/navigation';
import { requirePub } from '@/lib/pub';
import { createClient } from '@press/db/server';
import type { Article, Edition } from '@press/db';
import { type ArticleMap, freezeEdition, normalizeEdition } from '@press/ui';
import { PreviewClient } from '@/components/PreviewClient';

export const dynamic = 'force-dynamic';

export default async function Preview({ params }: { params: Promise<{ pub: string; id: string }> }) {
  const { pub: slug, id } = await params;
  const { pub } = await requirePub(slug);
  const supabase = await createClient();
  const [{ data: ed }, { data: arts }] = await Promise.all([
    supabase.from('editions').select('*').eq('id', id).maybeSingle(),
    supabase.from('articles').select('id,title,kicker,deck,byline,body,cover_url,cover_caption').eq('publication_id', pub.id),
  ]);
  if (!ed) notFound();
  const e = ed as Edition;
  const map: ArticleMap = Object.fromEntries(((arts ?? []) as Article[]).map(a => [a.id, a]));
  const data = freezeEdition(normalizeEdition(e.data, pub.type), map);
  return <PreviewClient edition={data} backHref={`/p/${pub.slug}/edisi/${e.id}`} status={e.status} />;
}
