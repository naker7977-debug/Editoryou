'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, getSession } from '@press/db/server';
import { DEFAULT_MOTION, magazineTemplatePages, newEditionData, newPage, PAGE_PRESETS } from '@press/ui';
import type { Publication } from '@press/db';

export async function createArticle(pubId: string, pubSlug: string) {
  const { supabase, user } = await getSession();
  if (!user) redirect('/masuk');
  const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const { data, error } = await supabase.from('articles').insert({ publication_id: pubId, author_id: user.id, title: 'Naskah baru', byline: prof?.full_name ?? '' }).select('id').single();
  if (error) throw new Error(error.message);
  redirect(`/p/${pubSlug}/naskah/${data.id}`);
}

export async function deleteArticle(id: string, pubSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('articles').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/p/${pubSlug}/naskah`);
  redirect(`/p/${pubSlug}/naskah`);
}

export async function createEdition(pub: Publication, opts: { withTemplate?: boolean } = {}) {
  const { supabase, user } = await getSession();
  if (!user) redirect('/masuk');
  const s = pub.settings ?? {};
  const data = newEditionData(pub.type, { name: pub.name, tagline: pub.tagline ?? '', city: pub.city ?? '', price: s.price ?? '', motto: s.motto ?? '' }, { accent: s.accent, tone: s.tone, mastheadStyle: s.mastheadStyle });
  data.motion = { ...DEFAULT_MOTION, ...Object.fromEntries(Object.entries(s.motion ?? {}).filter(([, v]) => v != null)) };
  if (opts.withTemplate) {
    if (pub.type === 'magazine') data.pages = magazineTemplatePages();
    else data.pages = ['np-front', 'np-3col', 'np-3col', 'np-opini', 'np-ads', 'np-3col'].map(id => PAGE_PRESETS.find(p => p.id === id)?.make() ?? newPage());
  }
  const today = new Date().toISOString().slice(0, 10);
  const { data: row, error } = await supabase.from('editions').insert({ publication_id: pub.id, title: pub.name, number: 'Edisi baru', edition_date: today, data, created_by: user.id }).select('id').single();
  if (error) throw new Error(error.message);
  redirect(`/p/${pub.slug}/edisi/${row.id}`);
}

export async function deleteEdition(id: string, pubSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('editions').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/p/${pubSlug}/edisi`);
  redirect(`/p/${pubSlug}/edisi`);
}

export async function updatePublicationSettings(pubId: string, pubSlug: string, form: FormData) {
  const supabase = await createClient();
  const { data: cur } = await supabase.from('publications').select('settings').eq('id', pubId).maybeSingle();
  const settings = {
    ...(cur?.settings ?? {}),
    openLayout: form.get('openLayout') === 'on',
    motion: {
      enabled: form.get('motion_enabled') === 'on',
      kiosk: form.get('motion_kiosk') === 'on',
      play: form.get('motion_play') === 'tap' ? 'tap' as const : 'auto' as const,
      filter: (['none', 'print', 'sepia', 'mono', 'duo'].includes(String(form.get('motion_filter'))) ? String(form.get('motion_filter')) : 'none') as 'none' | 'print' | 'sepia' | 'mono' | 'duo',
    },
    accent: String(form.get('accent') || '#8b1e1e'), tone: String(form.get('tone') || 'ivory'), mastheadStyle: String(form.get('mastheadStyle') || 'black'),
    price: String(form.get('price') || ''), motto: String(form.get('motto') || ''), frequency: String(form.get('frequency') || ''),
  };
  const { error } = await supabase.from('publications').update({ tagline: String(form.get('tagline') || ''), description: String(form.get('description') || ''), city: String(form.get('city') || ''), settings }).eq('id', pubId);
  if (error) throw new Error(error.message);
  revalidatePath(`/p/${pubSlug}`);
}
