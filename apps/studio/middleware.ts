import type { NextRequest } from 'next/server';
import { updateSession } from '@press/db/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request, { protect: p => !p.startsWith('/masuk') && !p.startsWith('/keluar') && !p.startsWith('/demo'), loginPath: '/masuk' });
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
