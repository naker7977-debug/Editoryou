import { NextResponse } from 'next/server';
import { createClient } from '@press/db/server';

export async function POST(request: Request) {
  const sb = await createClient();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
