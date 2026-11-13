import Link from 'next/link';
import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';

export default function Masuk() {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <div className="paper-card rounded-lg p-8">
        <h1 className="font-display text-3xl font-bold">Masuk</h1>
        <p className="mb-6 font-garamond italic text-ink-3">Selamat datang kembali, pembaca.</p>
        <div className="[&_.input]:border-ink/20 [&_.input]:bg-white/60 [&_.input]:text-ink [&_.label]:text-ink-3">
          <Suspense><AuthForm mode="masuk" /></Suspense>
        </div>
        <p className="mt-6 text-sm text-ink-3">Belum punya akun? <Link href="/daftar" className="underline">Daftar</Link></p>
      </div>
    </div>
  );
}
