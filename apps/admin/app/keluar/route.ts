import { NextResponse } from 'next/server';
import { createClient } from '@press/db/server';
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/masuk', request.url), { status: 303 });
}
