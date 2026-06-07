import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { ensureSession } from './lib/auth';
import type { Round, Screen, Hole } from './types';

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
  const [homeBannerText, setHomeBannerText] = useState('');

  useEffect(() => {
    ensureSession().finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (localStorage.getItem('home_banner_dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad/.test(ua);
    const isAndroid = /Android/.test(ua);
    if (isIOS) {
      setHomeBannerText('📱 홈화면에 추가하면 앱처럼 사용할 수 있어요 · Safari 하단 공유버튼 → 홈 화면에 추가');
      setShowHomeBanner(true);
    } else if (isAndroid) {
      setHomeBannerText('📱 홈화면에 추가하면 앱처럼 사용할 수 있어요 · Chrome 우측 메뉴 → 홈 화면에 추가');
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

  const showNav = screen !== 'hole-recording';

  if (!authReady) {
    return (
      <div className="flex justify-center bg-gray-200 min-h-screen">
        <div className="w-full max-w-[390px] bg-surface shadow-xl min-h-screen flex items-center justify-center">
          <p className="text-gray-500 text-sm">불러오는 중...</p>
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

        {showNav && showHomeBanner && (
          <div
            className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none"
            style={{ bottom: '64px' }}
          >
            <div className="w-full max-w-[390px] px-3 pointer-events-auto">
              <div className="bg-[#1B4332] text-white rounded-xl px-3 py-2.5 flex items-start gap-2 shadow-lg">
                <p className="text-xs leading-relaxed flex-1">{homeBannerText}</p>
                <button
                  onClick={dismissHomeBanner}
                  className="flex-shrink-0 p-0.5 text-white/80 active:opacity-70"
                  aria-label="닫기"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}