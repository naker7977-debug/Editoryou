'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SideNav({ items }: { items: { href: string; label: string; icon: string; exact?: boolean; dot?: string }[] }) {
  const path = usePathname();
  return (
    <nav className="p-3 space-y-1">
      {items.map(it => {
        const on = it.exact ? path === it.href : path.startsWith(it.href);
        return <Link key={it.href} href={it.href} className={'side-link' + (on ? ' on' : '')}><span className="w-4 text-center opacity-70">{it.icon}</span>{it.label}{it.dot && <span className="dot" style={{ color: it.dot, background: it.dot }} />}</Link>;
      })}
    </nav>
  );
}
