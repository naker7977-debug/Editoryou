'use client';
import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, err = false) => { setMsg({ text, err }); if (t.current) clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 3200); }, []);
  return { msg, show };
}
export function Toast({ t }: { t: ReturnType<typeof useToast> }) {
  if (!t.msg) return null;
  return <div className={'toast' + (t.msg.err ? ' err' : '')}>{t.msg.text}</div>;
}
