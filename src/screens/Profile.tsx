import { useState, useEffect } from 'react';
import { Settings, Clock, Database } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  signUpWithEmail,
  signOutAndReanonymous,
  getAuthProvider,
} from '../lib/auth';

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const provider = getAuthProvider(user);

  async function handleEmailSignUp() {
    if (!email.trim() || password.length < 6) {
      setError('이메일과 비밀번호(6자 이상)를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: err } = await signUpWithEmail(email.trim(), password);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEmailMode(false);
    setEmail('');
    setPassword('');
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u);
  }

  async function handleLogout() {
    setSubmitting(true);
    await signOutAndReanonymous();
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u);
    setEmailMode(false);
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <div className="px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
        <h1 className="text-xl font-bold text-gray-800">라운드 세팅</h1>
        <p className="text-sm text-gray-500 mt-1">앱 환경을 설정해요</p>
      </div>

      <div className="px-4 mt-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-2">불러오는 중...</p>
          ) : provider === 'anonymous' ? (
            <>
              <p className="text-sm font-medium text-gray-700 mb-1">로그인 / 회원가입</p>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                회원가입하면 데이터가 클라우드에 백업되어 기기를 바꿔도 유지됩니다.
              </p>
              {emailMode ? (
                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder="이메일"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
                  />
                  <input
                    type="password"
                    placeholder="비밀번호 (6자 이상)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
                  />
                  <button
                    onClick={handleEmailSignUp}
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {submitting ? '처리 중...' : '로그인 / 회원가입'}
                  </button>
                  <button
                    onClick={() => { setEmailMode(false); setError(''); }}
                    className="w-full py-2 text-sm text-gray-500"
                  >
                    뒤로
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEmailMode(true)}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
                >
                  이메일로 시작하기
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700 mb-1">계정</p>
              <p className="text-sm text-gray-600 mb-4">{user?.email ?? '연동된 계정'}</p>
              <button
                onClick={handleLogout}
                disabled={submitting}
                className="w-full py-3 rounded-xl text-red-500 font-semibold text-sm border border-red-200 active:scale-95 transition-transform disabled:opacity-50"
              >
                {submitting ? '처리 중...' : '로그아웃'}
              </button>
            </>
          )}
          {error && <p className="text-red-500 text-xs mt-3 text-center">{error}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-700 mb-4">업데이트 예정 기능</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
                <Settings size={18} className="text-[#1B4332]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">태그 관리</p>
                <p className="text-xs text-gray-400 mt-0.5">골프장, 동반자 등 자주 쓰는 태그를 미리 등록해요</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-[#1B4332]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">클럽 관리</p>
                <p className="text-xs text-gray-400 mt-0.5">사용하는 골프채를 등록하고 기록에 연동해요</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
                <Database size={18} className="text-[#1B4332]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">데이터 관리</p>
                <p className="text-xs text-gray-400 mt-0.5">라운드 데이터를 백업하고 내보낼 수 있어요</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="bg-[#1B4332]/5 rounded-2xl border border-[#1B4332]/10 p-4">
          <p className="text-xs text-[#1B4332] text-center leading-relaxed">
            세팅 기능은 순차적으로 업데이트될 예정이에요 😊
          </p>
        </div>
      </div>

      <div className="text-center mt-8">
        <p className="text-xs text-gray-400">Golf Memo v1.0.0</p>
      </div>
    </div>
  );
}
