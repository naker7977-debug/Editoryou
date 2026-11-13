/** Ilustrasi pengganti foto (SVG data-URI) — placeholder tanpa jaringan. URL "art:<kind>:<seed>" diresolusi oleh renderer. */
export type ArtKind = 'hills' | 'city' | 'market' | 'portrait' | 'abstract' | 'mag';
export type ArtPalette = 'sepia' | 'warm';

export function svgArt(kind: ArtKind | string, seed = 1, pal: ArtPalette = 'sepia'): string {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const W = 800, H = 520;
  const warm = pal === 'warm';
  const c = warm ? { a: '#b08968', b: '#7f5539', c: '#9c6644', d: '#3d2b1f', e: '#c0472b', sky1: '#e6ccb2', sky2: '#f5ebe0', sun: '#fff' }
                 : { a: '#9b8a66', b: '#7f6d4c', c: '#5f5038', d: '#3f3425', e: '#8b1e1e', sky1: '#d9c9a4', sky2: '#f1e6cc', sun: '#efe1bd' };
  const sky = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky1}"/><stop offset="1" stop-color="${c.sky2}"/></linearGradient><pattern id="ht" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.1" fill="#2a2119" opacity=".35"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
  let body = sky;
  if (kind === 'hills') {
    body += `<circle cx="${W * 0.72}" cy="150" r="58" fill="${c.sun}" stroke="${c.b}" stroke-width="2"/>`;
    [c.a, c.b, c.c, c.d].forEach((col, i) => { const y = 250 + i * 55; let d = `M0 ${y + 40}`; for (let x = 0; x <= W; x += 80) d += ` Q ${x + 40} ${y - 30 - rnd() * 50} ${x + 80} ${y + 20 + rnd() * 30}`; d += ` L${W} ${H} L0 ${H}Z`; body += `<path d="${d}" fill="${col}"/>`; });
  } else if (kind === 'city') {
    for (let i = 0; i < 18; i++) { const w = 30 + rnd() * 60, h = 120 + rnd() * 260, x = i * 45 - 10; body += `<rect x="${x}" y="${H - h}" width="${w}" height="${h}" fill="${[c.c, c.d, c.b, c.a][i % 4]}"/>`; for (let r = 0; r < h / 30; r++) for (let q = 0; q < w / 16; q++) if (rnd() > .5) body += `<rect x="${x + 4 + q * 16}" y="${H - h + 8 + r * 30}" width="7" height="12" fill="#e8d9a8" opacity=".8"/>`; }
    body += `<rect y="${H - 40}" width="${W}" height="40" fill="${c.d}"/>`;
  } else if (kind === 'market') {
    body += `<rect y="${H - 130}" width="${W}" height="130" fill="${c.a}"/>`;
    for (let i = 0; i < 9; i++) { const x = i * 95; body += `<path d="M${x} 200 L${x + 95} 200 L${x + 80} 250 L${x + 15} 250Z" fill="${i % 2 ? c.e : '#e8d9a8'}" opacity=".85"/><rect x="${x + 20}" y="250" width="55" height="140" fill="${c.b}"/>`; for (let k = 0; k < 6; k++) body += `<circle cx="${x + 25 + rnd() * 45}" cy="${270 + rnd() * 100}" r="${6 + rnd() * 8}" fill="${['#c9a24a', c.e, '#5b7a3a', '#e0c07a'][k % 4]}"/>`; }
  } else if (kind === 'portrait') {
    body += `<circle cx="${W / 2}" cy="200" r="90" fill="${c.b}"/><path d="M${W / 2 - 170} ${H} Q ${W / 2} 240 ${W / 2 + 170} ${H}Z" fill="${c.c}"/>`;
  } else if (kind === 'mag') {
    body = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f2937"/><stop offset="1" stop-color="#6b7280"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
    for (let i = 0; i < 14; i++) body += `<rect x="${rnd() * W}" y="${rnd() * H}" width="${60 + rnd() * 240}" height="${20 + rnd() * 120}" fill="#fff" opacity="${0.04 + rnd() * .12}" transform="rotate(${-20 + rnd() * 40})"/>`;
    body += `<circle cx="${W * .7}" cy="${H * .4}" r="${90 + rnd() * 60}" fill="#d97706" opacity=".85"/>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${body}</svg>`);
  } else {
    for (let i = 0; i < 40; i++) body += `<circle cx="${rnd() * W}" cy="${rnd() * H}" r="${rnd() * 60}" fill="${c.c}" opacity="${rnd() * .4}"/>`;
  }
  body += `<rect width="${W}" height="${H}" fill="url(#ht)" opacity="${warm ? .25 : .45}"/>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${body}</svg>`);
}

/** Resolusi URL gambar: "art:kind:seed[:pal]" → data URI; selain itu apa adanya. */
export function imgSrc(url: string | null | undefined, mag = false): string | null {
  if (!url) return null;
  if (url.startsWith('art:')) { const [, kind, seed, pal] = url.split(':'); return svgArt(kind, Number(seed) || 1, (pal as ArtPalette) || (mag ? 'warm' : 'sepia')); }
  return url;
}
