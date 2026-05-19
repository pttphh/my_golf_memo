import { useState } from 'react';
import { supabase } from './lib/supabase';
import type { Round, Screen } from './types';

import NavBar, { type NavTab } from './components/NavBar';
import NewRound from './screens/NewRound';
import HoleRecording from './screens/HoleRecording';
import HoleEdit from './screens/HoleEdit';
import RoundSummary from './screens/RoundSummary';
import MissBreakdown from './screens/MissBreakdown';
import RoundList from './screens/RoundList';
import AllRounds from './screens/AllRounds';
import HoleSelect from './screens/HoleSelect';
import HoleDetail from './screens/HoleDetail';

function screenToTab(screen: Screen): NavTab {
  if (screen === 'all-rounds') return 'all-rounds';
  if (['round-list', 'round-summary', 'miss-breakdown', 'hole-select', 'hole-detail', 'hole-edit'].includes(screen)) return 'round-list';
  return 'new-round';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('new-round');
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [selectedHoleIndices, setSelectedHoleIndices] = useState<number[]>([]);
  const [editHoleNumber, setEditHoleNumber] = useState<number>(1);
  const [continueFromHole, setContinueFromHole] = useState<number>(1);
  const [summaryViewMode, setSummaryViewMode] = useState<'recording' | 'view'>('recording');

  const activeTab = screenToTab(screen);

  function handleTabChange(tab: NavTab) {
    if (tab === 'new-round') setScreen('new-round');
    else if (tab === 'all-rounds') setScreen('all-rounds');
    else if (tab === 'round-list') setScreen('round-list');
  }

  function handleRoundStart(round: Round) {
    setCurrentRound(round);
    setScreen('hole-recording');
  }

  function handleFinish() {
    setSummaryViewMode('recording');
    setScreen('round-summary');
  }

  function handleSaveRound() {
    setCurrentRound(null);
    setScreen('new-round');
  }

  function handleRoundSelect(round: Round) {
    setCurrentRound(round);
    setSummaryViewMode('view');
    setScreen('round-summary');
  }

  async function handleDeleteRound() {
    if (!currentRound) return;
    await supabase.from('holes').delete().eq('round_id', currentRound.id);
    await supabase.from('rounds').delete().eq('id', currentRound.id);
    setCurrentRound(null);
    setScreen('round-list');
  }

  const showNav = screen !== 'hole-recording' && screen !== 'hole-edit';

  return (
    <div className="flex justify-center bg-gray-200 min-h-screen">
      <div className="w-full max-w-[390px] relative bg-gray-50 shadow-xl min-h-screen overflow-x-hidden flex flex-col">
        {showNav && <NavBar activeTab={activeTab} onTabChange={handleTabChange} />}

        <div className="flex-1">
          {screen === 'new-round' && (
            <NewRound onStart={handleRoundStart} />
          )}

          {screen === 'hole-recording' && currentRound && (
            <HoleRecording
              round={currentRound}
              initialHoleIndex={continueFromHole - 1}
              onFinish={handleFinish}
              onDeleteRound={handleDeleteRound}
            />
          )}

          {screen === 'hole-edit' && currentRound && (
            <HoleEdit
              round={currentRound}
              holeNumber={editHoleNumber}
              onBack={() => setScreen('hole-select')}
            />
          )}

          {screen === 'round-list' && (
            <RoundList onRoundSelect={handleRoundSelect} />
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
              onConfirm={indices => {
                setSelectedHoleIndices(indices);
                setScreen('hole-detail');
              }}
              onEditHole={holeNumber => {
                setEditHoleNumber(holeNumber);
                setScreen('hole-edit');
              }}
              onContinue={holeNumber => {
                setContinueFromHole(holeNumber);
                setScreen('hole-recording');
              }}
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
        </div>
      </div>
    </div>
  );
}
