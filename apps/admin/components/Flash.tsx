/** Pesan hasil aksi (?ok=… / ?err=…) di atas konten halaman. */
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return <div className={(err ? 'warnbox' : 'okbox') + ' mb-5 text-sm'} role={err ? 'alert' : 'status'}>{err ? '⚠ ' + err : '✓ ' + ok}</div>;
}
