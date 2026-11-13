import { LayoutEditor } from '@/components/LayoutEditor';
import { sampleMagazine, sampleNewspaper } from '@press/ui';
import type { Edition, Publication } from '@press/db';

/** Halaman demo editor tanpa basis data (untuk mencoba antarmuka). Perubahan tidak disimpan. */
export default async function Demo({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  const { jenis } = await searchParams;
  const mag = jenis === 'majalah';
  const now = new Date().toISOString();
  const pub: Publication = { id: 'demo', slug: mag ? 'lembar' : 'warta-nusantara', name: mag ? 'LEMBAR' : 'Warta Nusantara', type: mag ? 'magazine' : 'newspaper', tagline: '', description: null, city: 'Lembah Sari', logo_url: null, settings: {}, is_active: true, created_at: now, updated_at: now };
  const data = mag ? sampleMagazine() : sampleNewspaper();
  const edition: Edition = { id: 'demo-1', publication_id: 'demo', title: data.masthead.name, number: data.masthead.number ?? null, edition_date: data.masthead.date, status: 'draft', access: 'free', cover_url: null, data, created_by: null, published_at: null, created_at: now, updated_at: now };
  return <LayoutEditor edition={edition} pub={pub} articles={[]} canPublish={false} />;
}
