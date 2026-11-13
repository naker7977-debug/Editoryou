'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@press/db/browser';
import { hasSupabaseEnv } from '@press/db';

export function LoginForm({ title, subtitle }: { title: string; subtitle: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!hasSupabaseEnv()) { setMsg('Supabase belum dikonfigurasi (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).'); return; }
    setBusy(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(sp.get('next') || '/'); router.refresh();
    } catch (err) { setMsg((err as Error).message || 'Gagal masuk'); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card p-7 w-full max-w-sm mx-auto">
      <div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">{subtitle}</div>
      <h1 className="font-display text-3xl mt-1 mb-5">{title}</h1>
      <label className="block mb-3 text-xs uppercase tracking-wider text-[var(--muted)]">Surel<input className="input mt-1" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></label>
      <label className="block mb-4 text-xs uppercase tracking-wider text-[var(--muted)]">Kata sandi<input className="input mt-1" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {msg && <div className="text-sm text-[#f1b1a6] mb-3">{msg}</div>}
      <button className="btn gold w-full justify-center" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
      <p className="text-xs text-[var(--muted)] mt-4">Akun dibuat oleh admin platform. Hubungi admin bila lupa kata sandi.</p>
    </form>
  );
}
