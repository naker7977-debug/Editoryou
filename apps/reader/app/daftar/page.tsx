import Link from 'next/link';
import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';

export default function Daftar() {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <div className="paper-card rounded-lg p-8">
        <h1 className="font-display text-3xl font-bold">Daftar</h1>
        <p className="mb-6 font-garamond italic text-ink-3">Buat akun pembaca, lalu aktifkan langganan.</p>
        <div className="[&_.input]:border-ink/20 [&_.input]:bg-white/60 [&_.input]:text-ink [&_.label]:text-ink-3">
          <Suspense><AuthForm mode="daftar" /></Suspense>
        </div>
        <p className="mt-6 text-sm text-ink-3">Sudah punya akun? <Link href="/masuk" className="underline">Masuk</Link></p>
      </div>
    </div>
  );
}
