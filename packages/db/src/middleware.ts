import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export interface SessionGuard {
  /** Awalan path yang wajib login. */
  protectedPrefixes?: string[];
  /** Predikat kustom: true = path wajib login. */
  protect?: (path: string) => boolean;
  /** Halaman login untuk pengalihan. */
  loginPath?: string;
}

/** Menyegarkan sesi Supabase di setiap permintaan dan (opsional) melindungi path tertentu. */
export async function updateSession(request: NextRequest, guard: SessionGuard = {}) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const needsAuth = (guard.protectedPrefixes ?? []).some((p) => path === p || path.startsWith(p + '/')) || (guard.protect ? guard.protect(path) : false);
  if (!url || !anon) return response; // tanpa konfigurasi: biarkan halaman menjelaskan sendiri

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (needsAuth && !user) {
    const login = request.nextUrl.clone();
    login.pathname = guard.loginPath ?? '/masuk';
    login.search = '';
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }
  return response;
}
