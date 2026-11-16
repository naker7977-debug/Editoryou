// Tipe baris database — selaras dengan supabase/migrations/0001_init.sql
export type PublicationKind = 'newspaper' | 'magazine';
export type MemberRole = 'chief' | 'editor' | 'designer' | 'journalist' | 'writer';
export type ArticleStatus = 'draft' | 'review' | 'ready' | 'published' | 'archived';
export type EditionStatus = 'draft' | 'review' | 'ready' | 'published' | 'archived';
export type ContentStatus = ArticleStatus;
export type EditionAccess = 'free' | 'subscribers';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type GlobalRole = 'user' | 'superadmin';
export type PlanInterval = 'month' | 'year';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: GlobalRole;
  created_at: string;
}

export interface PublicationSettings {
  accent?: string;
  tone?: 'ivory' | 'aged' | 'sepia' | 'bright' | 'white';
  mastheadStyle?: 'black' | 'serif' | 'caps' | 'modern';
  price?: string;
  motto?: string;
  frequency?: string;
  /** Semua anggota boleh menata halaman & membuat edisi (bawaan: ya untuk majalah). */
  openLayout?: boolean;
  /** Foto hidup: bawaan untuk edisi baru. */
  motion?: { enabled?: boolean; filter?: 'none' | 'print' | 'sepia' | 'mono' | 'duo'; play?: 'auto' | 'tap'; kiosk?: boolean };
}

export interface Publication {
  id: string;
  slug: string;
  name: string;
  type: PublicationKind;
  tagline: string | null;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  settings: PublicationSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicationMember {
  id: string;
  publication_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  profiles?: Profile | null;
  publications?: Publication | null;
}

export interface Article {
  id: string;
  publication_id: string;
  author_id: string | null;
  section: string | null;
  kicker: string | null;
  title: string;
  deck: string | null;
  byline: string | null;
  body: string;
  cover_url: string | null;
  cover_caption: string | null;
  tags: string[] | null;
  status: ArticleStatus;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, 'full_name' | 'email'> | null;
}

export interface Edition {
  id: string;
  publication_id: string;
  title: string;
  number: string | null;
  edition_date: string;
  access: EditionAccess;
  status: EditionStatus;
  cover_url: string | null;
  cover_data?: unknown | null; // EditionData beku berisi halaman sampul saja (publik)
  data: unknown;               // EditionData (@press/ui)
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  publications?: Publication | null;
}

export interface Media {
  id: string;
  publication_id: string;
  path: string;
  url: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  uploader_id: string | null;
  created_at: string;
  /** 'video' untuk foto hidup (berkas video); poster_url = bingkai diamnya. */
  kind?: 'image' | 'video' | null;
  poster_url?: string | null;
}

export interface Plan {
  id: string;
  publication_id: string | null;
  name: string;
  interval: PlanInterval;
  price_idr: number;
  is_active: boolean;
  created_at: string;
  publications?: Pick<Publication, 'name' | 'slug'> | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  publication_id: string | null;
  plan_id: string | null;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string;
  activated_by: string | null;
  payment_ref: string | null;
  note: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'full_name' | 'email'> | null;
  plans?: Pick<Plan, 'name' | 'interval'> | null;
  publications?: Pick<Publication, 'name' | 'slug'> | null;
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  chief: 'Pemimpin Redaksi',
  editor: 'Redaktur',
  designer: 'Penata Letak',
  journalist: 'Wartawan',
  writer: 'Penulis',
};
export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: 'Draf', review: 'Menunggu Redaktur', ready: 'Siap Tayang', published: 'Terbit', archived: 'Arsip',
};
export const EDITION_STATUS_LABEL: Record<EditionStatus, string> = {
  draft: 'Draf', review: 'Tinjauan', ready: 'Siap', published: 'Terbit', archived: 'Arsip',
};
export const KIND_LABEL: Record<PublicationKind, string> = { newspaper: 'Koran', magazine: 'Majalah' };

type RoleLike = MemberRole | 'superadmin' | null | undefined;
/** Boleh menata halaman edisi. */
export const canLayout = (role: RoleLike) => role === 'superadmin' || (!!role && ['chief', 'editor', 'designer'].includes(role));
/** Boleh menerbitkan edisi & menyunting semua naskah. */
/** Tata letak terbuka untuk semua anggota? (bawaan: majalah ya, koran tidak) */
export const layoutOpen = (pub: { type: PublicationKind; settings?: PublicationSettings | null }) => pub.settings?.openLayout ?? pub.type === 'magazine';
/** Boleh menata halaman di penerbit ini: redaktur/penata letak, atau semua anggota bila tata letak terbuka. */
export const canLayoutIn = (pub: { type: PublicationKind; settings?: PublicationSettings | null }, role: RoleLike) => canLayout(role) || (!!role && layoutOpen(pub));
export const canPublish = (role: RoleLike) => role === 'superadmin' || (!!role && ['chief', 'editor'].includes(role));
export const canReview = canPublish;
/** Boleh mengubah pengaturan penerbit. */
export const canManageMembers = (role: RoleLike) => role === 'superadmin' || role === 'chief';

export function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}
export function formatDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('id-ID', opts); } catch { return String(d); }
}
