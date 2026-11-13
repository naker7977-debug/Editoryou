import { createClient } from '@press/db/server';
import type { Edition, Publication } from '@press/db';
import { normalizeEdition, type EditionData } from '@press/ui';

export async function listPublications(): Promise<Publication[]> {
  const sb = await createClient();
  const { data } = await sb.from('publications').select('*').eq('is_active', true).order('name');
  return (data ?? []) as Publication[];
}
export async function getPublication(slug: string): Promise<Publication | null> {
  const sb = await createClient();
  const { data } = await sb.from('publications').select('*').eq('slug', slug).maybeSingle();
  return (data as Publication) ?? null;
}
export async function listPublishedEditions(publicationId?: string, limit = 50): Promise<Edition[]> {
  const sb = await createClient();
  let q = sb.from('editions').select('id,publication_id,title,number,edition_date,access,status,cover_url,cover_data,published_at,created_at,updated_at,created_by, publications(*)').eq('status', 'published').order('published_at', { ascending: false }).limit(limit);
  if (publicationId) q = q.eq('publication_id', publicationId);
  const { data } = await q;
  return (data ?? []) as unknown as Edition[];
}
export async function getEdition(id: string): Promise<Edition | null> {
  const sb = await createClient();
  const { data } = await sb.from('editions').select('id,publication_id,title,number,edition_date,access,status,cover_url,cover_data,published_at,created_at,updated_at,created_by, publications(*)').eq('id', id).maybeSingle();
  return (data as unknown as Edition) ?? null;
}
/** Edisi beku untuk pembaca; null = terkunci (butuh langganan) atau belum terbit. */
export async function getSnapshot(editionId: string, kind: Publication['type']): Promise<EditionData | null> {
  const sb = await createClient();
  const { data } = await sb.from('edition_snapshots').select('data').eq('edition_id', editionId).maybeSingle();
  if (!data?.data) return null;
  return normalizeEdition(data.data, kind);
}
/** Sampul publik (1 halaman) untuk thumbnail; null bila tidak ada. */
export function coverOf(pub: Publication, ed: Edition): EditionData | null {
  if (!ed.cover_data) return null;
  const d = normalizeEdition(ed.cover_data, pub.type);
  return { ...d, pages: d.pages.slice(0, 1) };
}
