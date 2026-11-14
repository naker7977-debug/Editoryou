'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSuperadmin } from './guard';
import { createClient } from '@press/db/server';
import { ROLE_LABEL, type MemberRole } from '@press/db';
import { SERVICE_KEY_HINT } from '@press/db/admin';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/* ---------- setup ---------- */
export async function claimSuperadmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('claim_first_superadmin');
  if (error) throw new Error(error.message);
  if (!data) redirect('/setup?gagal=1');
  redirect('/');
}

/* ---------- penerbit ---------- */
export async function createPublication(form: FormData) {
  const { admin } = await requireSuperadmin();
  const slug = s(form, 'slug').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const { error } = await admin.from('publications').insert({ slug, name: s(form, 'name'), type: s(form, 'type') || 'newspaper', tagline: s(form, 'tagline') || null, city: s(form, 'city') || null,
    settings: s(form, 'type') === 'magazine' ? { accent: '#111111', tone: 'bright', mastheadStyle: 'caps', frequency: 'Bulanan' } : { accent: '#8b1e1e', tone: 'ivory', mastheadStyle: 'black', frequency: 'Harian' } });
  if (error) throw new Error(error.message);
  revalidatePath('/penerbit'); redirect('/penerbit');
}
export async function updatePublication(id: string, form: FormData) {
  const { admin } = await requireSuperadmin();
  const { data: cur } = await admin.from('publications').select('settings').eq('id', id).single();
  const settings = { ...(cur?.settings ?? {}), frequency: s(form, 'frequency'), price: s(form, 'price'), motto: s(form, 'motto') };
  const { error } = await admin.from('publications').update({ name: s(form, 'name'), slug: s(form, 'slug').toLowerCase(), type: s(form, 'type'), tagline: s(form, 'tagline') || null, description: s(form, 'description') || null, city: s(form, 'city') || null, is_active: form.get('is_active') === 'on', settings }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/penerbit/${id}`); revalidatePath('/penerbit');
}
export async function deletePublication(id: string) {
  const { admin } = await requireSuperadmin();
  const { error } = await admin.from('publications').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/penerbit'); redirect('/penerbit');
}

/* ---------- akun & anggota ---------- */
async function findOrCreateUser(admin: Awaited<ReturnType<typeof requireSuperadmin>>['admin'], email: string, fullName: string, password?: string) {
  if (!email.includes('@')) throw new Error('invalid format');
  const { data: existing, error: findErr } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (existing) return existing.id as string;
  if (!password || password.length < 6) throw new Error('Akun belum ada — isi kata sandi (min. 6 karakter) untuk membuatnya.');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw new Error(error.message);
  // trigger handle_new_user membuat profil; pastikan nama tersimpan
  await admin.from('profiles').upsert({ id: data.user.id, email, full_name: fullName });
  return data.user.id;
}

/** Ubah pesan teknis Supabase menjadi kalimat yang bisa ditindaklanjuti. */
function friendly(e: unknown) {
  const m = (e as Error)?.message ?? String(e);
  if (/valid Bearer token|Invalid API key|User not allowed/i.test(m)) return SERVICE_KEY_HINT;
  if (/already (been )?registered|already exists/i.test(m)) return 'Surel ini sudah terdaftar. Kosongkan kata sandi untuk menugaskan akun yang sudah ada.';
  if (/invalid format|validate email/i.test(m)) return 'Format surel tidak valid (contoh: nama@sekolah.sch.id).';
  if (/password/i.test(m)) return 'Kata sandi terlalu lemah — minimal 6 karakter.';
  return m;
}
const withMsg = (path: string, key: 'ok' | 'err', msg: string) => `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`;

export async function addMember(form: FormData) {
  const { admin } = await requireSuperadmin();
  const email = s(form, 'email').toLowerCase(), name = s(form, 'full_name'), password = s(form, 'password');
  const publicationId = s(form, 'publication_id'), role = (s(form, 'role') || 'writer') as MemberRole;
  const back = s(form, 'back') || '/anggota';
  let errMsg = '';
  try {
    const userId = await findOrCreateUser(admin, email, name, password);
    const { error } = await admin.from('publication_members').upsert({ publication_id: publicationId, user_id: userId, role }, { onConflict: 'publication_id,user_id' });
    if (error) throw new Error(error.message);
  } catch (e) { errMsg = friendly(e); }
  revalidatePath(back);
  redirect(errMsg ? withMsg(back, 'err', errMsg) : withMsg(back, 'ok', `${name || email} ditambahkan sebagai ${ROLE_LABEL[role]}.`));
}
export async function updateMemberRole(memberId: string, role: MemberRole, back: string) {
  const { admin } = await requireSuperadmin();
  const { error } = await admin.from('publication_members').update({ role }).eq('id', memberId);
  if (error) throw new Error(error.message);
  revalidatePath(back);
}
export async function removeMember(memberId: string, back: string) {
  const { admin } = await requireSuperadmin();
  const { error } = await admin.from('publication_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);
  revalidatePath(back);
}
export async function resetPassword(userId: string, form: FormData) {
  const { admin } = await requireSuperadmin();
  const password = s(form, 'password');
  if (password.length < 6) throw new Error('Kata sandi minimal 6 karakter');
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  revalidatePath('/anggota'); revalidatePath('/pembaca');
}
export async function setGlobalRole(userId: string, role: 'user' | 'superadmin') {
  const { admin, profile } = await requireSuperadmin();
  if (userId === profile.id && role !== 'superadmin') throw new Error('Tidak dapat mencabut superadmin diri sendiri');
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/anggota');
}
export async function createReader(form: FormData) {
  const { admin } = await requireSuperadmin();
  let errMsg = '';
  try { await findOrCreateUser(admin, s(form, 'email').toLowerCase(), s(form, 'full_name'), s(form, 'password')); }
  catch (e) { errMsg = friendly(e); }
  revalidatePath('/pembaca');
  redirect(errMsg ? withMsg('/pembaca', 'err', errMsg) : withMsg('/pembaca', 'ok', 'Akun pembaca dibuat.'));
}

/* ---------- paket & langganan ---------- */
export async function createPlan(form: FormData) {
  const { admin } = await requireSuperadmin();
  const pubId = s(form, 'publication_id');
  const { error } = await admin.from('plans').insert({ name: s(form, 'name'), interval: s(form, 'interval') || 'month', price_idr: Number(s(form, 'price_idr') || 0), publication_id: pubId || null });
  if (error) throw new Error(error.message);
  revalidatePath('/paket');
}
export async function togglePlan(id: string, active: boolean) {
  const { admin } = await requireSuperadmin();
  await admin.from('plans').update({ is_active: active }).eq('id', id);
  revalidatePath('/paket');
}
export async function activateSubscription(form: FormData) {
  const { admin, profile } = await requireSuperadmin();
  const userId = s(form, 'user_id'), planId = s(form, 'plan_id');
  const { data: plan } = await admin.from('plans').select('*').eq('id', planId).single();
  if (!plan) throw new Error('Paket tidak ditemukan');
  const start = s(form, 'starts_at') ? new Date(s(form, 'starts_at')) : new Date();
  const months = Number(s(form, 'months') || (plan.interval === 'year' ? 12 : 1));
  const end = new Date(start); end.setMonth(end.getMonth() + months);
  const { error } = await admin.from('subscriptions').insert({ user_id: userId, plan_id: plan.id, publication_id: plan.publication_id, status: 'active', starts_at: start.toISOString(), ends_at: end.toISOString(), activated_by: profile.id, payment_ref: s(form, 'payment_ref') || null, note: s(form, 'note') || null });
  if (error) throw new Error(error.message);
  revalidatePath('/pembaca'); revalidatePath(`/pembaca/${userId}`);
}
export async function cancelSubscription(id: string) {
  const { admin } = await requireSuperadmin();
  await admin.from('subscriptions').update({ status: 'cancelled' }).eq('id', id);
  revalidatePath('/pembaca');
}
