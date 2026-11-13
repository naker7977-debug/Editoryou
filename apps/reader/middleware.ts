import type { NextRequest } from 'next/server';
import { updateSession } from '@press/db/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request, { protectedPrefixes: ['/akun'], loginPath: '/masuk' });
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
