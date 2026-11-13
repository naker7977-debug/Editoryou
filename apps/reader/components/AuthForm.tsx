'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@press/db/browser';

export function AuthForm({ mode }: { mode: 'masuk' | 'daftar' }) {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/';
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const sb = createClient();
      if (mode === 'masuk') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next); router.refresh();
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
        if (error) throw error;
        if (data.session) { router.replace(next); router.refresh(); }
        else setMsg('Pendaftaran berhasil. Periksa email Anda untuk tautan konfirmasi, lalu masuk.');
      }
    } catch (err: any) { setMsg(err?.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : (err?.message || 'Terjadi kesalahan.')); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === 'daftar' && <div><label className="label">Nama lengkap</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>}
      <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
      <div><label className="label">Kata sandi</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} /></div>
      {msg && <div className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn btn-gold w-full justify-center" disabled={busy}>{busy ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Daftar'}</button>
    </form>
  );
}
