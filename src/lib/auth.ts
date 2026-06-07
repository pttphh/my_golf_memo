import { supabase } from './supabaseClient';

export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    await supabase.auth.signInAnonymously();
  }
}

export async function isAnonymousUser(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.is_anonymous === true;
}

export async function linkGoogleAccount() {
  return supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.updateUser({ email, password });
}

export async function signOutAndReanonymous() {
  await supabase.auth.signOut();
  await supabase.auth.signInAnonymously();
}

export function getAuthProvider(user: { is_anonymous?: boolean; identities?: { provider: string }[] } | null): 'anonymous' | 'google' | 'email' {
  if (!user || user.is_anonymous) return 'anonymous';
  const providers = user.identities?.map(i => i.provider) ?? [];
  if (providers.includes('google')) return 'google';
  return 'email';
}
