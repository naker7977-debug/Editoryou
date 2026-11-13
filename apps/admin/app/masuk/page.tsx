import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';
export default function Page() {
  return <main className="min-h-screen flex items-center px-5 py-16"><Suspense><LoginForm title="Kontrol Platform" subtitle="Admin · Masuk" /></Suspense></main>;
}
