import { requirePub } from '@/lib/pub';
import { createClient } from '@press/db/server';
import type { Media } from '@press/db';
import { MediaLibrary } from '@/components/MediaLibrary';

export const dynamic = 'force-dynamic';

export default async function MediaPage({ params }: { params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const { pub } = await requirePub(slug);
  const supabase = await createClient();
  const { data } = await supabase.from('media').select('*').eq('publication_id', pub.id).order('created_at', { ascending: false }).limit(500);
  return <MediaLibrary pub={pub} initial={(data as Media[]) ?? []} />;
}
