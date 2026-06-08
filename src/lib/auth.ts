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
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) {
    // 홈화면 앱 모드에서는 Safari로 강제 이동
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
      },
    });
    if (data?.url) window.open(data.url, '_blank');
    return { data, error };
  }
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}


export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpNewUser(email: string, password: string) {
  // 익명 계정을 이메일 계정으로 전환
  const { error: linkError } = await supabase.auth.updateUser({ email });
  if (linkError) return { error: linkError };
  // 비밀번호 별도 설정
  return supabase.auth.updateUser({ password });
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