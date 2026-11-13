import { deep, newBlock, newEditionData, newPage, today, type Block, type EditionData, type Page } from './model';
import { SAMPLE_NEWSPAPER_PAGES } from './sampleNewspaper';

const B = (type: Block['type'], patch: Partial<Block>): Block => ({ ...newBlock(type, 'magazine'), ...patch });
const P = (section: string, blocks: Block[], extra: Partial<Page> = {}): Page => ({ ...newPage(section), ...extra, blocks });

/** Edisi koran contoh "Warta Nusantara" (konten fiktif). */
export function sampleNewspaper(): EditionData {
  const d = newEditionData('newspaper', { name: 'Warta Nusantara', tagline: 'Suara Daerah — Jujur, Teliti, Bermartabat', number: 'Edisi 1.204 · Tahun LXIV', date: today(), city: 'Lembah Sari', price: 'Rp 5.000', motto: 'Terbit sejak 1962' }, { accent: '#8b1e1e', tone: 'ivory', mastheadStyle: 'black' });
  d.pages = deep(SAMPLE_NEWSPAPER_PAGES);
  return d;
}

/** Edisi majalah contoh "LEMBAR" bergaya majalah modern (konten fiktif). */
export function sampleMagazine(): EditionData {
  const d = newEditionData('magazine', { name: 'LEMBAR', tagline: 'Majalah gaya hidup, arsitektur & perjalanan', number: 'No. 12 · Vol. III', date: today(), city: 'Lembah Sari', price: 'Rp 45.000', motto: 'Edisi bulanan', coverLines: ['Kopi dari lereng Ijen', 'Panduan tenun Sumba', 'Arsitektur bambu kontemporer'] }, { accent: '#b45309', tone: 'bright', mastheadStyle: 'caps' });
  d.pages = [
    P('Sampul', [B('cover', { w: 12, h: 12, img: { url: 'art:hills:8:warm' }, kicker: 'Edisi Rumah & Cahaya', title: 'Hidup Pelan di Rumah yang Bernapas', deck: 'Enam arsitek muda tentang ventilasi silang, teras, dan kemewahan udara bersih.', invert: true })]),
    P('Daftar Isi', [B('toc', { w: 12, h: 12, title: 'Isi' })]),
    P('Feature', [B('feature', { w: 12, h: 12, img: { url: 'art:city:12:warm' }, kicker: 'Arsitektur', title: 'Rumah yang Bernapas', deck: 'Di pinggiran Yogyakarta, sepasang arsitek membangun rumah tanpa pendingin udara — dan mengundang angin masuk.', byline: 'Laras Anindita · Foto: Dimas Prasetyo', invert: true })]),
    P('Feature', [
      B('text', { w: 7, h: 12, cols: 2, scale: 'l', dropcap: true, kicker: 'Arsitektur', title: 'Rumah yang Bernapas', byline: 'Laras Anindita',
        body: `Pagi di rumah itu dimulai dengan suara: daun pintu kayu yang digeser, kemudian angin. Tidak ada deru kompresor. Udara mengalir dari sawah di utara, melewati ruang keluarga, dan keluar lewat kisi-kisi bata di sisi selatan.\n\n"Kami tidak melawan iklim, kami bernegosiasi dengannya," kata Raka, yang bersama istrinya, Nadia, merancang rumah ini selama dua tahun. Atap tinggi, bukaan berhadapan, dan kolam dangkal di tengah rumah bekerja seperti paru-paru.\n\nKemewahan, menurut mereka, bukan marmer atau lampu gantung, melainkan udara yang bergerak dan cahaya yang berubah sepanjang hari. Dinding kapur putih memantulkan sinar pagi menjadi lembut, sementara sore hari bata berlubang menggambar pola di lantai.\n\nRumah ini tidak sempurna. Debu masuk ketika musim kemarau, dan hujan deras kadang menyelinap ke teras. Tetapi penghuninya menerima itu sebagai bagian dari percakapan dengan alam.` }),
      B('quote', { w: 5, h: 5, body: 'Kami tidak melawan iklim. Kami bernegosiasi dengannya.', byline: 'Raka, arsitek' }),
      B('image', { w: 5, h: 7, img: { url: 'art:portrait:4:warm' }, cap: 'Nadia di ruang kerja yang menghadap kolam dangkal.' }),
    ]),
    P('Galeri', [
      B('gallery', { w: 12, h: 9, images: [{ url: 'art:hills:21:warm' }, { url: 'art:market:22:warm' }, { url: 'art:city:23:warm' }, { url: 'art:abstract:24:warm' }], cap: 'Lereng Ijen pada pukul lima pagi; pasar kopi Bondowoso; gudang pengering tua yang kini menjadi kedai; biji arabika setelah proses natural.' }),
      B('brief', { w: 12, h: 3, dropcap: false, kicker: 'Rasa', title: 'Kopi dari Lereng Ijen', body: 'Petani di lereng Ijen kini memproses kopi mereka sendiri, bukan lagi menjual ceri mentah ke tengkulak. Hasilnya: cangkir dengan rasa buah tropis dan keasaman yang bersih.' }),
    ]),
    P('Rubrik', [
      B('text', { w: 6, h: 12, cols: 1, kicker: 'Kriya', title: 'Panduan Tenun Sumba', byline: 'Mira Kusuma', img: { url: 'art:market:31:warm' }, cap: 'Penenun di Kampung Prailiu.', body: `Motif kuda dan udang pada tenun Sumba Timur bukan hiasan semata; keduanya adalah catatan silsilah. Satu lembar hinggi bisa memakan waktu setahun.\n\nKami menyusun panduan singkat: cara membedakan pewarna alami dari sintetis, dan mengapa harga yang adil penting bagi penenun.` }),
      B('text', { w: 6, h: 12, cols: 1, kicker: 'Desain', title: 'Bambu yang Tak Lagi Sementara', byline: 'Redaksi', img: { url: 'art:mag:9:warm' }, cap: 'Aula bambu berbentang 30 meter di Jawa Barat.', body: `Dulu bambu dianggap bahan darurat. Kini, dengan pengawetan modern dan sambungan baja, arsitek membangun aula dan hotel berbentang lebar dari bambu.\n\nKami mengunjungi tiga bangunan di Bali dan Jawa Barat yang membuktikan bambu bisa bertahan puluhan tahun — dan tampil elegan.` }),
    ]),
    P('Potret', [
      B('text', { w: 7, h: 12, cols: 1, scale: 'l', kicker: 'Potret', title: 'Mbah Darmi: Enam Dekade Menjaga Api Tungku', byline: 'Nurul Aini', body: `Tangannya keriput, tetapi gerakannya mengaduk adonan gula di wajan besar masih mantap. Mbah Darmi tidak pernah menghitung berapa ribu kilogram getuk yang telah lahir dari tungku itu.\n\nIa menolak disebut pengusaha. "Saya cuma tukang masak," katanya. Padahal, dari kios kecil itu, ia menyekolahkan lima anak hingga sarjana.\n\nResepnya tidak pernah ditulis. Semua diwariskan lewat tangan: cara merasakan panas wajan, kapan gula harus diangkat, berapa lama singkong dikukus.` }),
      B('image', { w: 5, h: 12, img: { url: 'art:portrait:14:warm' }, cap: 'Mbah Darmi di depan tungku kayu yang menemaninya sejak 1964.' }),
    ], { dark: true }),
  ];
  return d;
}
