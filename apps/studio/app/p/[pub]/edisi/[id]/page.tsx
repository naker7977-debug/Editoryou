import { notFound, redirect } from 'next/navigation';
import { requirePub } from '@/lib/pub';
import { createClient } from '@press/db/server';
import { canLayout, canPublish, type Article, type Edition } from '@press/db';
import { LayoutEditor } from '@/components/LayoutEditor';

export const dynamic = 'force-dynamic';

export default async function EditionPage({ params }: { params: Promise<{ pub: string; id: string }> }) {
  const { pub: slug, id } = await params;
  const { pub, role } = await requirePub(slug);
  if (!(role === 'superadmin' || canLayout(role))) redirect(`/p/${slug}/edisi/${id}/pratinjau`);
  const supabase = await createClient();
  const [{ data: ed }, { data: arts }] = await Promise.all([
    supabase.from('editions').select('*').eq('id', id).maybeSingle(),
    supabase.from('articles').select('id,title,kicker,deck,byline,body,cover_url,cover_caption,status,updated_at,profiles(full_name)').eq('publication_id', pub.id).order('updated_at', { ascending: false }).limit(400),
  ]);
  if (!ed) notFound();
  return <LayoutEditor edition={ed as Edition} pub={pub} articles={(arts ?? []) as unknown as Article[]} canPublish={role === 'superadmin' || canPublish(role)} />;
}
