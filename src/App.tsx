import { useState } from 'react';
import { supabase } from './lib/supabase';
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
      </div>
    </div>
  );
}