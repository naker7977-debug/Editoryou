'use client';
import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

let client: ReturnType<typeof createBrowserClient> | null = null;
export function createClient() {
  if (client) return client;
  const { url, anon } = supabaseEnv();
  client = createBrowserClient(url, anon);
  return client;
}
