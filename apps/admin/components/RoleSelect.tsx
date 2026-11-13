'use client';
import { useTransition } from 'react';
import { ROLE_LABEL, type MemberRole } from '@press/db';

export function RoleSelect({ value, action, back }: { value: MemberRole; action: (role: MemberRole, back: string) => Promise<void>; back: string }) {
  const [pending, start] = useTransition();
  return (
    <select className="input" style={{ width: 'auto', padding: '.3rem .5rem', fontSize: '.78rem' }} defaultValue={value} disabled={pending} onChange={e => start(() => action(e.target.value as MemberRole, back))}>
      {(Object.keys(ROLE_LABEL) as MemberRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
  );
}
