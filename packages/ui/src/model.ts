// ============================================================
//  Model data edisi — dipakai studio (editor), reader, dan snapshot terbit
// ============================================================
export type PublicationKind = 'newspaper' | 'magazine';
export type BlockType = 'lead' | 'article' | 'brief' | 'image' | 'quote' | 'ad' | 'cover' | 'toc' | 'text' | 'feature' | 'gallery';
export type Tone = 'ivory' | 'aged' | 'sepia' | 'bright' | 'white';
export type MastheadStyle = 'black' | 'serif' | 'caps' | 'modern';

export interface BlockImage { url: string; path?: string | null; w?: number; h?: number }

export interface Block {
  id: string;
  type: BlockType;
  w: number;            // 1–12 kolom grid
  h: number;            // 1–12 baris grid
  cols?: number;        // kolom teks 1–4
  scale?: 's' | 'm' | 'l';
  dropcap?: boolean;
  articleId?: string | null;        // tautan ke naskah (isi diambil dari naskah saat dirender/dibekukan)
  sourceArticleId?: string | null;  // diisi saat edisi dibekukan (publish)
  kicker?: string;
  title?: string;
  deck?: string;
  byline?: string;
  body?: string;
  img?: BlockImage | null;
  images?: BlockImage[];            // galeri
  cap?: string;
  imgH?: 's' | 'm' | 'l';
  invert?: boolean;                 // teks putih di atas foto (cover/feature)
}

export interface Page {
  id: string;
  section: string;
  dark?: boolean;       // majalah: halaman gelap
  bg?: BlockImage | null;
  blocks: Block[];
}

export interface Masthead {
  name: string;
  tagline?: string;
  number?: string;
  date: string;         // ISO yyyy-mm-dd
  city?: string;
  price?: string;
  motto?: string;
  coverLines?: string[]; // majalah: teaser di sampul
}

export interface EditionTheme { accent: string; tone: Tone; mastheadStyle: MastheadStyle }

export interface EditionData {
  kind: PublicationKind;
  masthead: Masthead;
  theme: EditionTheme;
  pages: Page[];
}

export interface ArticleLike {
  id: string;
  title: string;
  body: string;
  kicker?: string | null;
  deck?: string | null;
  byline?: string | null;
  cover_url?: string | null;
  cover_caption?: string | null;
  status?: string;
}
export type ArticleMap = Record<string, ArticleLike>;

export interface BlockTypeInfo { label: string; hint: string; w: number; h: number; kinds: PublicationKind[] }
export const BLOCK_TYPES: Record<BlockType, BlockTypeInfo> = {
  lead:    { label: 'Berita Utama', hint: 'Judul besar, deck, foto, 2–3 kolom teks', w: 8, h: 9, kinds: ['newspaper'] },
  article: { label: 'Artikel',      hint: 'Tulisan biasa dengan foto opsional',     w: 4, h: 6, kinds: ['newspaper', 'magazine'] },
  brief:   { label: 'Kilas',        hint: 'Berita singkat / agenda / pengumuman',   w: 4, h: 3, kinds: ['newspaper', 'magazine'] },
  image:   { label: 'Foto',         hint: 'Foto tunggal dengan keterangan',         w: 4, h: 4, kinds: ['newspaper', 'magazine'] },
  quote:   { label: 'Kutipan',      hint: 'Kutipan menonjol',                      w: 4, h: 3, kinds: ['newspaper', 'magazine'] },
  ad:      { label: 'Iklan',        hint: 'Boks iklan berbingkai',                  w: 4, h: 3, kinds: ['newspaper', 'magazine'] },
  cover:   { label: 'Sampul',       hint: 'Sampul majalah: foto penuh + nama + teaser', w: 12, h: 12, kinds: ['magazine'] },
  toc:     { label: 'Daftar Isi',   hint: 'Daftar isi otomatis dari halaman',       w: 12, h: 12, kinds: ['magazine'] },
  text:    { label: 'Teks Majalah', hint: 'Teks panjang gaya majalah, 1–2 kolom',   w: 7, h: 12, kinds: ['magazine'] },
  feature: { label: 'Feature',      hint: 'Pembuka rubrik: foto penuh + judul besar', w: 12, h: 12, kinds: ['magazine'] },
  gallery: { label: 'Galeri',       hint: 'Kisi 2–4 foto',                          w: 12, h: 6, kinds: ['magazine'] },
};

export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const deep = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const paras = (t: string | null | undefined) => String(t ?? '').split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);
export const words = (t: string | null | undefined) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length;
export function fmtDate(d: string | undefined) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; }
}
export const today = () => new Date().toISOString().slice(0, 10);

export function newBlock(type: BlockType, kind: PublicationKind = 'newspaper'): Block {
  const t = BLOCK_TYPES[type] ?? BLOCK_TYPES.article;
  const mag = kind === 'magazine';
  return {
    id: uid(), type, w: t.w, h: t.h,
    cols: type === 'lead' ? 3 : type === 'article' || type === 'text' ? 2 : 1,
    scale: 'm', dropcap: type !== 'brief',
    articleId: null,
    kicker: '', title: ['ad'].includes(type) ? 'Nama Usaha Anda' : ['image', 'cover', 'toc', 'gallery', 'quote'].includes(type) ? '' : 'Judul tulisan',
    deck: '', byline: '', body: '', img: null, images: [], cap: '', imgH: mag ? 'l' : 'm', invert: type === 'cover' || type === 'feature',
  };
}
export const newPage = (section = 'Halaman Baru'): Page => ({ id: uid(), section, dark: false, bg: null, blocks: [] });
export const defaultTheme = (kind: PublicationKind): EditionTheme =>
  kind === 'magazine' ? { accent: '#111111', tone: 'bright', mastheadStyle: 'caps' } : { accent: '#8b1e1e', tone: 'ivory', mastheadStyle: 'black' };

export function newEditionData(kind: PublicationKind, masthead: Partial<Masthead> & { name: string }, theme: Partial<EditionTheme> = {}): EditionData {
  const t = defaultTheme(kind);
  const clean = Object.fromEntries(Object.entries(theme).filter(([, v]) => v != null && v !== '')) as Partial<EditionTheme>;
  return {
    kind,
    masthead: { tagline: '', number: '', city: '', price: '', motto: '', coverLines: [], date: today(), ...masthead },
    theme: { ...t, ...clean },
    pages: [newPage(kind === 'magazine' ? 'Sampul' : 'Utama')],
  };
}

/** Pastikan data edisi lama / tidak lengkap tetap dapat dirender. */
export function normalizeEdition(raw: unknown, kind: PublicationKind): EditionData {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<EditionData> & { meta?: Partial<Masthead> };
  const k = d.kind ?? kind;
  const base = newEditionData(k, { name: '', ...(d.masthead ?? d.meta ?? {}) }, d.theme ?? {});
  const pages = Array.isArray(d.pages) && d.pages.length ? d.pages : base.pages;
  return {
    ...base,
    pages: pages.map((p) => ({ id: p.id || uid(), section: p.section ?? '', dark: !!p.dark, bg: p.bg ?? null,
      blocks: (p.blocks ?? []).map((b) => ({ ...newBlock((b.type as BlockType) ?? 'article', k), ...b, id: b.id || uid() })) })),
  };
}

/** Isi blok setelah menggabungkan naskah tertaut (naskah menang untuk isi; blok memegang tata letak). */
export function resolveBlock(b: Block, articles: ArticleMap): Block {
  if (!b.articleId) return b;
  const a = articles[b.articleId];
  if (!a) return b;
  return {
    ...b,
    kicker: a.kicker ?? b.kicker, title: a.title || b.title, deck: a.deck ?? b.deck, byline: a.byline ?? b.byline, body: a.body || b.body,
    img: b.img ?? (a.cover_url ? { url: a.cover_url } : null),
    cap: b.cap || a.cover_caption || '',
  };
}
/** Bekukan edisi: semua tautan naskah diresolusi menjadi isi tetap (untuk snapshot terbit & pratinjau). */
export function freezeEdition(data: EditionData, articles: ArticleMap): EditionData {
  return {
    ...deep(data),
    pages: data.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...resolveBlock(b, articles), sourceArticleId: b.articleId ?? b.sourceArticleId ?? null, articleId: null })) })),
  };
}

/* ---------- Preset susunan halaman ---------- */
export interface PagePreset { id: string; label: string; kinds: PublicationKind[]; make: () => Page }
const mk = (type: BlockType, kind: PublicationKind, patch: Partial<Block> = {}): Block => ({ ...newBlock(type, kind), ...patch });
const pg = (section: string, blocks: Block[], extra: Partial<Page> = {}): Page => ({ ...newPage(section), ...extra, blocks });
export const PAGE_PRESETS: PagePreset[] = [
  { id: 'np-front', label: 'Halaman muka', kinds: ['newspaper'], make: () => pg('Utama', [
    mk('lead', 'newspaper', { w: 8, h: 9, cols: 3 }), mk('article', 'newspaper', { w: 4, h: 6, cols: 1 }), mk('brief', 'newspaper', { w: 4, h: 3 }),
    mk('quote', 'newspaper', { w: 4, h: 3 }), mk('ad', 'newspaper', { w: 4, h: 3 }), mk('brief', 'newspaper', { w: 4, h: 3 }) ]) },
  { id: 'np-3col', label: 'Halaman dalam (2 artikel + kilas + foto + iklan)', kinds: ['newspaper'], make: () => pg('Daerah', [
    mk('article', 'newspaper', { w: 7, h: 7, cols: 2 }), mk('article', 'newspaper', { w: 5, h: 7, cols: 1 }), mk('brief', 'newspaper', { w: 4, h: 5 }),
    mk('image', 'newspaper', { w: 4, h: 5 }), mk('ad', 'newspaper', { w: 4, h: 5 }) ]) },
  { id: 'np-opini', label: 'Opini / tajuk', kinds: ['newspaper'], make: () => pg('Opini', [
    mk('article', 'newspaper', { w: 6, h: 12, cols: 1, scale: 'l' }), mk('article', 'newspaper', { w: 6, h: 7, cols: 1 }), mk('quote', 'newspaper', { w: 6, h: 3 }), mk('brief', 'newspaper', { w: 6, h: 2 }) ]) },
  { id: 'np-ads', label: 'Halaman iklan', kinds: ['newspaper', 'magazine'], make: () => pg('Iklan', [
    mk('ad', 'newspaper', { w: 6, h: 6 }), mk('ad', 'newspaper', { w: 6, h: 6 }), mk('ad', 'newspaper', { w: 4, h: 3 }), mk('ad', 'newspaper', { w: 4, h: 3 }), mk('ad', 'newspaper', { w: 4, h: 3 }), mk('brief', 'newspaper', { w: 12, h: 3, dropcap: false }) ]) },
  { id: 'mg-cover', label: 'Sampul majalah', kinds: ['magazine'], make: () => pg('Sampul', [ mk('cover', 'magazine', { w: 12, h: 12 }) ]) },
  { id: 'mg-toc', label: 'Daftar isi', kinds: ['magazine'], make: () => pg('Daftar Isi', [ mk('toc', 'magazine', { w: 12, h: 12, title: 'Isi' }) ]) },
  { id: 'mg-feature', label: 'Pembuka feature (foto penuh)', kinds: ['magazine'], make: () => pg('Feature', [ mk('feature', 'magazine', { w: 12, h: 12 }) ]) },
  { id: 'mg-text', label: 'Halaman teks (teks + foto + kutipan)', kinds: ['magazine'], make: () => pg('Feature', [
    mk('text', 'magazine', { w: 7, h: 12, cols: 2 }), mk('quote', 'magazine', { w: 5, h: 5 }), mk('image', 'magazine', { w: 5, h: 7 }) ]) },
  { id: 'mg-gallery', label: 'Galeri foto', kinds: ['magazine'], make: () => pg('Galeri', [ mk('gallery', 'magazine', { w: 12, h: 9 }), mk('brief', 'magazine', { w: 12, h: 3, dropcap: false }) ]) },
  { id: 'mg-half', label: 'Dua tulisan berdampingan', kinds: ['magazine'], make: () => pg('Rubrik', [
    mk('text', 'magazine', { w: 6, h: 12, cols: 1 }), mk('text', 'magazine', { w: 6, h: 12, cols: 1 }) ]) },
  { id: 'mg-dark', label: 'Halaman gelap (foto + teks putih)', kinds: ['magazine'], make: () => pg('Potret', [
    mk('text', 'magazine', { w: 7, h: 12, cols: 1, scale: 'l' }), mk('image', 'magazine', { w: 5, h: 12 }) ], { dark: true }) },
  { id: 'blank', label: 'Halaman kosong', kinds: ['newspaper', 'magazine'], make: () => pg('Halaman', []) },
];
