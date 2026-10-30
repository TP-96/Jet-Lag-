'use client';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Profile } from './actions';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!isConfigured) throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  if (!client) {
    client = createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

// ── accounts ──
// Players sign in with an email and password. The account (not the device) owns
// your player profile and your games, so signing in on another phone picks up
// exactly where you left off.

export const AUTH_REQUIRED = 'Sign in to play';

/** The signed-in user, or null. Old anonymous device sessions are signed out. */
export async function currentUser(): Promise<User | null> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  const u = data.session?.user ?? null;
  if (u?.is_anonymous) {
    await sb.auth.signOut();
    return null;
  }
  return u;
}

export async function ensureUser(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new Error(AUTH_REQUIRED);
  return u.id;
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match. Check both, or create an account.';
  if (/already registered|already been registered|user already exists/i.test(message)) return 'There’s already an account with that email. Sign in instead.';
  if (/password should be at least/i.test(message)) return 'Use a password with at least 6 characters.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/unable to validate email|invalid email/i.test(message)) return 'That doesn’t look like an email address.';
  return message;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw new Error(friendlyAuthError(error?.message ?? 'Could not sign in'));
  return data.user;
}

/** Returns the new user, or null when the project requires email confirmation first. */
export async function signUpWithEmail(email: string, password: string, profile: Profile): Promise<User | null> {
  const { data, error } = await supabase().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { profile }, emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  // Supabase hides "already registered" behind an empty identities list.
  if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error(friendlyAuthError('already registered'));
  return data.session ? data.user : null;
}

export async function signOut() {
  await supabase().auth.signOut();
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function setNewPassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** Your name, pin and colour live on the account so they follow you between devices. */
export function profileFromUser(u: User | null): Profile | null {
  const p = (u?.user_metadata as { profile?: Profile } | undefined)?.profile;
  return p && typeof p.name === 'string' ? p : null;
}

export async function saveProfileRemote(profile: Profile) {
  const { error } = await supabase().auth.updateUser({ data: { profile } });
  if (error) throw new Error(error.message);
}

export interface MyGame {
  code: string;
  name: string;
  status: string;
  created_at: string;
}

/** Games this account has joined, newest first. */
export async function myGames(uid: string): Promise<MyGame[]> {
  const { data, error } = await supabase()
    .from('players')
    .select('joined_at, games(code, name, status, created_at)')
    .eq('user_id', uid)
    .order('joined_at', { ascending: false })
    .limit(8);
  if (error) return [];
  return (data ?? [])
    .map((r) => (Array.isArray(r.games) ? r.games[0] : r.games) as MyGame | null)
    .filter((g): g is MyGame => !!g);
}

export async function uploadMedia(gameId: string, file: Blob, ext = 'jpg'): Promise<string> {
  const sb = supabase();
  const path = `${gameId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/** Shrink phone photos before upload so chat stays fast on mobile data. */
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality));
}
