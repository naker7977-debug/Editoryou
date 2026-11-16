// ============================================================
//  Model data edisi — dipakai studio (editor), reader, dan snapshot terbit
// ============================================================
export type PublicationKind = 'newspaper' | 'magazine';
export type BlockType = 'lead' | 'article' | 'brief' | 'image' | 'quote' | 'ad' | 'cover' | 'toc' | 'text' | 'feature' | 'gallery';
export type Tone = 'ivory' | 'aged' | 'sepia' | 'bright' | 'white';
export type MastheadStyle = 'black' | 'serif' | 'caps' | 'modern';

/* ---------- Foto hidup (gambar yang bergerak) ---------- */
export type MotionFilter = 'none' | 'print' | 'sepia' | 'mono' | 'duo';
export type MotionPlay = 'auto' | 'tap';
export const MOTION_FILTER_LABEL: Record<MotionFilter, string> = { none: 'Asli', print: 'Cetak koran', sepia: 'Sepia', mono: 'Hitam-putih', duo: 'Duotone aksen' };
export interface BlockMotion {
  kind: 'file' | 'youtube';
  src: string;              // URL berkas video, atau ID video YouTube
  path?: string | null;     // path di storage (berkas)
  filter?: MotionFilter | null; // null/undefined = ikut bawaan edisi
  play?: MotionPlay | null;     // auto = berulang tanpa suara saat halaman terbuka; tap = diam sampai diketuk
  sound?: boolean;          // boleh bersuara saat diketuk
  start?: number;           // detik awal (YouTube)
}
/** Pengaturan foto hidup per edisi (disalin dari pengaturan penerbit saat edisi dibuat). */
export interface EditionMotion { enabled: boolean; filter: MotionFilter; play: MotionPlay; kiosk: boolean }
export const DEFAULT_MOTION: EditionMotion = { enabled: true, filter: 'none', play: 'auto', kiosk: true };

export interface BlockImage { url: string; path?: string | null; w?: number; h?: number; motion?: BlockMotion | null }

/** Ambil ID video dari tautan YouTube apa pun (watch, youtu.be, shorts, embed) atau ID polos. */
export function youtubeId(input: string): string | null {
  const s = (input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith('http') ? s : 'https://' + s);
    const h = u.hostname.replace(/^www\.|^m\./, '');
    if (h === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v')!.slice(0, 11);
      const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch { /* bukan URL */ }
  return null;
}
export const ytPoster = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
/** Gambar diam untuk sebuah slot: foto yang dipilih, atau sampul YouTube bila hanya ada video. */
export const posterOf = (im?: BlockImage | null) => im?.url || (im?.motion?.kind === 'youtube' ? ytPoster(im.motion.src) : '') || null;

export interface Block {
  id: string;
  type: BlockType;
  w: number;            // 1–12 kolom grid
  h: number;            // 1–12 baris grid
  x?: number | null;    // 0–11 kolom awal (posisi bebas, opsional — tanpa ini blok mengalir otomatis)
  y?: number | null;    // 0–11 baris awal
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

export type PageStage = 'cover' | 'toc' | 'editorial' | 'main' | 'free';
export const STAGE_LABEL: Record<PageStage, string> = { cover: 'Sampul', toc: 'Daftar Isi', editorial: 'Salam Redaksi', main: 'Liputan Utama', free: 'Halaman kreatif' };

export interface Page {
  id: string;
  section: string;
  stage?: PageStage;    // tahapan edisi majalah
  locked?: boolean;     // lembar inti templat: tidak bisa dipindah/dihapus
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
  motion?: EditionMotion;
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

/* ---------- Posisi bebas (mode Lego) ---------- */
export const isPlaced = (b: Block) => b.x != null && b.y != null;
export const pagePlaced = (p: Page) => p.blocks.length > 0 && p.blocks.every(isPlaced);

/** Tiru penempatan otomatis CSS grid (dense) agar blok tidak "melompat" saat beralih ke posisi bebas. */
export function autoPlace(blocks: Block[], cols = 12, rows = 12): Block[] {
  const occ: boolean[][] = [];
  const free = (r: number, c: number, w: number, h: number) => {
    if (c + w > cols) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (occ[y]?.[x]) return false;
    return true;
  };
  const mark = (r: number, c: number, w: number, h: number) => { for (let y = r; y < r + h; y++) { occ[y] ??= []; for (let x = c; x < c + w; x++) occ[y][x] = true; } };
  for (const b of blocks) if (isPlaced(b)) mark(b.y!, b.x!, clamp(b.w, 1, cols), clamp(b.h, 1, rows));
  return blocks.map((b) => {
    if (isPlaced(b)) return b;
    const w = clamp(b.w || 4, 1, cols), h = clamp(b.h || 4, 1, rows);
    for (let r = 0; r < rows * 4; r++) for (let c = 0; c <= cols - w; c++) if (free(r, c, w, h)) { mark(r, c, w, h); return { ...b, x: c, y: Math.min(r, rows - 1) }; }
    return { ...b, x: 0, y: 0 };
  });
}
/** Cari tempat kosong pertama untuk blok baru berukuran w×h (atau kiri-atas bila penuh). */
export function firstFreeSpot(blocks: Block[], w: number, h: number, cols = 12, rows = 12): { x: number; y: number } {
  const occ = (x: number, y: number) => blocks.some((b) => isPlaced(b) && x >= b.x! && x < b.x! + b.w && y >= b.y! && y < b.y! + b.h);
  for (let y = 0; y <= rows - h; y++) for (let x = 0; x <= cols - w; x++) {
    let ok = true;
    for (let yy = y; yy < y + h && ok; yy++) for (let xx = x; xx < x + w && ok; xx++) if (occ(xx, yy)) ok = false;
    if (ok) return { x, y };
  }
  return { x: 0, y: 0 };
}

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
    motion: d.motion ? { ...DEFAULT_MOTION, ...d.motion } : undefined,
    pages: pages.map((p) => ({ id: p.id || uid(), section: p.section ?? '', dark: !!p.dark, bg: p.bg ?? null, stage: p.stage, locked: !!p.locked,
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
  { id: 'mg-cover', label: 'Sampul majalah', kinds: ['magazine'], make: () => pg('Sampul', [ mk('cover', 'magazine', { w: 12, h: 12 }) ], { stage: 'cover' }) },
  { id: 'mg-toc', label: 'Daftar isi', kinds: ['magazine'], make: () => pg('Daftar Isi', [ mk('toc', 'magazine', { w: 12, h: 12, title: 'Isi' }) ], { stage: 'toc' }) },
  { id: 'mg-editorial', label: 'Salam redaksi', kinds: ['magazine'], make: () => pg('Salam Redaksi', [
    mk('text', 'magazine', { w: 7, h: 12, x: 0, y: 0, cols: 1, kicker: 'SALAM REDAKSI', title: 'Halo, pembaca!', body: 'Tulis sapaan tim redaksi untuk edisi ini: tema besar, cerita di balik layar, dan ucapan terima kasih.' }),
    mk('image', 'magazine', { w: 5, h: 7, x: 7, y: 0, title: 'Tim redaksi' }),
    mk('quote', 'magazine', { w: 5, h: 5, x: 7, y: 7, body: 'Kutipan favorit tim untuk edisi ini.' }) ], { stage: 'editorial' }) },
  { id: 'mg-main', label: 'Liputan utama', kinds: ['magazine'], make: () => pg('Liputan Utama', [ mk('feature', 'magazine', { w: 12, h: 12, x: 0, y: 0, kicker: 'LIPUTAN UTAMA', title: 'Judul liputan utama edisi ini' }) ], { stage: 'main' }) },
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

/** Templat utama edisi majalah: 4 lembar inti terkunci + halaman kreatif awal. */
export const MAGAZINE_TEMPLATE: { preset: string; locked: boolean }[] = [
  { preset: 'mg-cover', locked: true }, { preset: 'mg-toc', locked: true }, { preset: 'mg-editorial', locked: true }, { preset: 'mg-main', locked: true },
  { preset: 'mg-text', locked: false }, { preset: 'mg-gallery', locked: false }, { preset: 'mg-half', locked: false },
];
export function magazineTemplatePages(): Page[] {
  return MAGAZINE_TEMPLATE.map(({ preset, locked }) => {
    const p = (PAGE_PRESETS.find((x) => x.id === preset) ?? PAGE_PRESETS[PAGE_PRESETS.length - 1]).make();
    return { ...p, locked, stage: p.stage ?? 'free', blocks: autoPlace(p.blocks) };
  });
}
