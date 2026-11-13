import { notFound } from 'next/navigation';
import { requirePub } from '@/lib/pub';
import { createClient } from '@press/db/server';
import type { Article } from '@press/db';
import { ArticleEditor } from '@/components/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function ArticlePage({ params }: { params: Promise<{ pub: string; id: string }> }) {
  const { pub: slug, id } = await params;
  const { pub, role, userId } = await requirePub(slug);
  const supabase = await createClient();
  const { data } = await supabase.from('articles').select('*, profiles(full_name,email)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const a = data as unknown as Article;
  const isEditor = role === 'superadmin' || role === 'chief' || role === 'editor' || role === 'designer';
  const canEdit = isEditor || (a.author_id === userId && ['draft', 'review', 'ready'].includes(a.status));
  return <ArticleEditor article={a} pub={pub} canEdit={canEdit} isEditor={isEditor} />;
}
