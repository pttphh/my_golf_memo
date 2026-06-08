import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { ensureSession } from './lib/auth';
import type { Round, Screen, Hole } from './types';

const shareId = new URLSearchParams(window.location.search).get('share');

import BottomNav, { type NavTab } from './components/BottomNav';
import NewRound from './screens/NewRound';
import HoleRecording from './screens/HoleRecording';
import RoundSummary from './screens/RoundSummary';
import MissBreakdown from './screens/MissBreakdown';
import RoundList from './screens/RoundList';
import AllRounds from './screens/AllRounds';
import HoleSelect from './screens/HoleSelect';
import HoleDetail from './screens/HoleDetail';
import Profile from './screens/Profile';

function screenToTab(screen: Screen): NavTab {
  if (screen === 'all-rounds') return 'all-rounds';
  if (screen === 'profile') return 'profile';
  if (screen === 'settings') return 'settings';
  return 'round-list';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('round-list');
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [selectedHoleIndices, setSelectedHoleIndices] = useState<number[]>([]);
  const [editHoleNumber, setEditHoleNumber] = useState<number>(1);
  const [editInitialHole, setEditInitialHole] = useState<Hole | undefined>();
  const [isRecordingEditMode, setIsRecordingEditMode] = useState(false);
  const [continueFromHole, setContinueFromHole] = useState<number>(1);
  const [summaryViewMode, setSummaryViewMode] = useState<'recording' | 'view'>('recording');
  const [authReady, setAuthReady] = useState(false);
  const [showHomeBanner, setShowHomeBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [sharedRound, setSharedRound] = useState<Round | null>(null);
  const [shareLoading, setShareLoading] = useState(!!shareId);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (shareId) {
      setAuthReady(true);
      return;
    }
    ensureSession().finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!shareId) return;
    async function loadSharedRound() {
      setShareLoading(true);
      setShareError(null);
      const { data: round, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', shareId)
        .maybeSingle();
      if (error || !round) {
        setShareError('공유된 라운드를 찾을 수 없습니다.');
        setShareLoading(false);
        return;
      }
      if (!round.is_public) {
        setShareError('비공개 라운드입니다.');
        setShareLoading(false);
        return;
      }
      setSharedRound(round as Round);
      setShareLoading(false);
    }
    loadSharedRound();
  }, []);

  useEffect(() => {
    if (shareId) return;
    if (localStorage.getItem('home_banner_dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) {
      setIsIOS(true);
      setShowHomeBanner(true);
    } else if (/Android/.test(ua)) {
      setIsIOS(false);
      setShowHomeBanner(true);
    }
  }, []);

  function dismissHomeBanner() {
    localStorage.setItem('home_banner_dismissed', '1');
    setShowHomeBanner(false);
  }

  const activeTab = screenToTab(screen);

  function handleTabChange(tab: NavTab) {
    if (tab === 'all-rounds') setScreen('all-rounds');
    else if (tab === 'round-list') setScreen('round-list');
    else if (tab === 'settings') setScreen('settings');
    else if (tab === 'profile') setScreen('profile');
  }

  function handleRoundStart(round: Round) {
    setCurrentRound(round);
    setContinueFromHole(1);
    setIsRecordingEditMode(false);
    setEditInitialHole(undefined);
    setScreen('hole-recording');
  }

  function handleFinish() {
    setSummaryViewMode('recording');
    setScreen('round-summary');
  }

  function handleSaveRound() {
    setCurrentRound(null);
    setScreen('round-list');
  }

  function handleRoundSelect(round: Round) {
    setCurrentRound(round);
    setSummaryViewMode('view');
    setScreen('round-summary');
  }

  function handleIncompleteRoundSelect(round: Round) {
    setCurrentRound(round);
    setScreen('hole-select');
  }

  async function handleDeleteRound() {
    if (!currentRound) return;
    await supabase.from('holes').delete().eq('round_id', currentRound.id);
    await supabase.from('rounds').delete().eq('id', currentRound.id);
    setCurrentRound(null);
    setScreen('round-list');
  }

  const showNav = !shareId && screen !== 'hole-recording';

  if (!authReady) {
    return (
      <div className="flex justify-center bg-gray-200 min-h-screen">
        <div className="w-full max-w-[390px] bg-surface shadow-xl min-h-screen flex items-center justify-center">
          <p className="text-gray-500 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (shareId) {
    if (shareLoading) {
      return (
        <div className="flex justify-center bg-gray-200 min-h-screen">
          <div className="w-full max-w-[390px] bg-surface shadow-xl min-h-screen flex items-center justify-center">
            <p className="text-gray-500 text-sm">불러오는 중...</p>
          </div>
        </div>
      );
    }
    if (shareError || !sharedRound) {
      return (
        <div className="flex justify-center bg-gray-200 min-h-screen">
          <div className="w-full max-w-[390px] bg-surface shadow-xl min-h-screen flex items-center justify-center px-6">
            <p className="text-gray-500 text-sm text-center">{shareError ?? '공유된 라운드를 찾을 수 없습니다.'}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-center bg-gray-200 min-h-screen">
        <div className="w-full max-w-[390px] relative bg-surface shadow-xl min-h-screen flex flex-col">
          <RoundSummary round={sharedRound} viewMode="view" shareMode />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-gray-200 min-h-screen">
<div className="w-full max-w-[390px] relative bg-surface shadow-xl min-h-screen flex flex-col">        <div className="flex-1">
          {screen === 'new-round' && (
            <NewRound onStart={handleRoundStart} />
          )}

          {screen === 'hole-recording' && currentRound && (
            <HoleRecording
              round={currentRound}
              initialHoleIndex={(isRecordingEditMode ? editHoleNumber : continueFromHole) - 1}
              initialHole={isRecordingEditMode ? editInitialHole : undefined}
              isEditMode={isRecordingEditMode}
              onFinish={isRecordingEditMode ? undefined : handleFinish}
              onDeleteRound={handleDeleteRound}
              onExit={isRecordingEditMode ? undefined : () => setScreen('round-list')}
              onBack={isRecordingEditMode ? () => setScreen('hole-select') : undefined}
            />
          )}

          {screen === 'round-list' && (
            <RoundList
              onRoundSelect={handleRoundSelect}
              onIncompleteRoundSelect={handleIncompleteRoundSelect}
              onAddRound={() => setScreen('new-round')}
            />
          )}

          {screen === 'round-summary' && currentRound && (
            <RoundSummary
              round={currentRound}
              viewMode={summaryViewMode}
              onSave={handleSaveRound}
              onDelete={handleDeleteRound}
              onMissBreakdown={() => setScreen('miss-breakdown')}
              onViewHoles={() => setScreen('hole-select')}
            />
          )}

          {screen === 'miss-breakdown' && currentRound && (
            <MissBreakdown
              roundId={currentRound.id}
              onBack={() => setScreen('round-summary')}
            />
          )}

          {screen === 'hole-select' && currentRound && (
            <HoleSelect
            roundId={currentRound.id}
            onBack={() => setScreen('round-summary')}
            onConfirm={() => {}}
            onEditHole={(holeNumber, existingHole) => {
              setEditHoleNumber(holeNumber);
              setEditInitialHole(existingHole);
              setIsRecordingEditMode(true);
              setScreen('hole-recording');
            }}
            onContinue={holeNumber => {
              setContinueFromHole(holeNumber);
              setIsRecordingEditMode(false);
              setEditInitialHole(undefined);
              setScreen('hole-recording');
            }}
            onDelete={handleDeleteRound}
          />
          )}

          {screen === 'hole-detail' && currentRound && (
            <HoleDetail
              roundId={currentRound.id}
              selectedIndices={selectedHoleIndices}
              onBack={() => setScreen('hole-select')}
            />
          )}

          {screen === 'all-rounds' && (
            <AllRounds onRoundSelect={handleRoundSelect} />
          )}

{screen === 'settings' && (
  <Profile />
)}

{screen === 'profile' && (
  <Profile />
)}
        </div>

        {showNav && <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />}

        {showHomeBanner && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={dismissHomeBanner} />
            <div className="relative bg-white rounded-t-2xl w-full max-w-[390px] p-5 pb-10">
              <h3 className="text-base font-bold text-gray-800 mb-2">📱 홈화면에 추가하기</h3>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                홈화면에 추가하면 앱처럼 빠르게 실행할 수 있어요.
              </p>
              <div className="space-y-4 mb-6">
                {(isIOS
                  ? [
                      'Safari 하단의 공유 버튼(네모에 화살표 올라가는 아이콘)을 탭하세요.',
                      '스크롤을 내려 "홈 화면에 추가"를 탭하세요.',
                      '우측 상단 "추가"를 탭하면 완료!',
                    ]
                  : [
                      'Chrome 우측 상단 점 세 개 메뉴를 탭하세요.',
                      '"홈 화면에 추가"를 탭하세요.',
                      '"추가"를 탭하면 완료!',
                    ]
                ).map((text, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-[#1B4332] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-600 leading-relaxed pt-0.5">{text}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={dismissHomeBanner}
                className="w-full py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-transform"
              >
                확인했어요
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}