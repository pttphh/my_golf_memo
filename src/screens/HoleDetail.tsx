import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Hole } from '../types';
import { getScoreLabel } from '../types';

interface Props {
  roundId: string;
  selectedIndices: number[];
  onBack: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1.5">
      <span className="text-xs text-gray-500 w-20 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 flex-1">{value}</span>
    </div>
  );
}

function ShotSection({ title, club, result, penaltyType, miss, memo }: {
  title: string; club: string; result: string; penaltyType: string; miss: string; memo: string;
}) {
  const hasAny = club || result || penaltyType || miss || memo;
  if (!hasAny) return null;

  const resultDisplay = result === '벌타' && penaltyType ? `벌타 (${penaltyType})` : result;

  return (
    <div className="border-t border-gray-100 pt-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{title}</p>
      <div className="divide-y divide-gray-50">
        <Row label="클럽" value={club} />
        <Row label="결과" value={resultDisplay} />
        <Row label="미스 유형" value={miss} />
        <Row label="메모" value={memo} />
      </div>
    </div>
  );
}

function HoleCard({ hole }: { hole: Hole }) {
  const overPar = hole.over_par;
  const overStr = overPar > 0 ? `+${overPar}` : overPar === 0 ? 'E' : `${overPar}`;

  let scoreBg = 'bg-green-50 border-green-200 text-[#1B4332]';
  if (overPar > 1) scoreBg = 'bg-red-50 border-red-200 text-red-500';
  else if (overPar === 1) scoreBg = 'bg-yellow-50 border-yellow-200 text-yellow-700';
  else if (overPar < 0) scoreBg = 'bg-blue-50 border-blue-200 text-blue-600';

  const secondShots = [
    { key: '세컨샷 1', club: hole.second1_club, result: hole.second1_result, penalty: hole.second1_penalty_type, miss: hole.second1_miss, memo: hole.second1_memo },
    { key: '세컨샷 2', club: hole.second2_club, result: hole.second2_result, penalty: hole.second2_penalty_type, miss: hole.second2_miss, memo: hole.second2_memo },
    { key: '세컨샷 3', club: hole.second3_club, result: hole.second3_result, penalty: hole.second3_penalty_type, miss: hole.second3_miss, memo: hole.second3_memo },
  ].filter(s => s.club || s.result || s.miss || s.memo);

  const approaches = [
    { key: '어프로치 1', club: hole.approach1_club, result: hole.approach1_result, miss: hole.approach1_miss, memo: hole.approach1_memo },
    { key: '어프로치 2', club: hole.approach2_club, result: hole.approach2_result, miss: hole.approach2_miss, memo: hole.approach2_memo },
  ].filter(a => a.club || a.miss || a.memo);

  return (
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-b border-gray-100">
        <div>
          <p className="font-bold text-gray-800 text-base">{hole.hole_number}번 홀</p>
          <p className="text-xs text-gray-500">파{hole.par} · {hole.total_strokes}타</p>
        </div>
        <div className={`rounded-xl border-2 px-3 py-1.5 text-center ${scoreBg}`}>
          <p className="font-extrabold text-xl leading-none">{overStr}</p>
          <p className="text-[10px] mt-0.5 opacity-80">{getScoreLabel(overPar)}</p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-0">
        <div className="flex gap-4 pb-3 border-b border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-500">온그린</p>
            <p className="text-base font-bold text-gray-800">{hole.green_shots}타</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">퍼팅</p>
            <p className="text-base font-bold text-gray-800">{hole.putts}개</p>
          </div>
        </div>

        <ShotSection title="티샷" club={hole.tee_club} result={hole.tee_result} penaltyType={hole.tee_penalty_type} miss={hole.tee_miss} memo={hole.tee_memo} />

        {secondShots.map(s => (
          <ShotSection key={s.key} title={secondShots.length > 1 ? s.key : '세컨샷'} club={s.club} result={s.result} penaltyType={s.penalty} miss={s.miss} memo={s.memo} />
        ))}

        {approaches.map(a => (
          <div key={a.key} className="border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              {approaches.length > 1 ? a.key : '어프로치'}
            </p>
            <div className="divide-y divide-gray-50">
              <Row label="결과" value={a.result} />
              <Row label="미스 유형" value={a.miss} />
              <Row label="메모" value={a.memo} />
            </div>
          </div>
        ))}

        {(hole.putts > 0 || hole.putt_memo) && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">퍼팅</p>
            <div className="divide-y divide-gray-50">
              <Row label="퍼팅 수" value={`${hole.putts}개`} />
              <Row label="메모" value={hole.putt_memo} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HoleDetail({ roundId, selectedIndices, onBack }: Props) {
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('holes')
        .select('*')
        .eq('round_id', roundId)
        .order('hole_number');
      setHoles((data ?? []) as Hole[]);
      setLoading(false);
    }
    fetch();
  }, [roundId]);

  const selectedHoles = selectedIndices.map(i => holes[i]).filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <div className="bg-[#1B4332] text-white px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-green-200 text-sm mb-3 active:opacity-70">
          <ChevronLeft size={16} /> 홀 선택으로
        </button>
        <h2 className="text-xl font-bold">홀별 기록</h2>
        <p className="text-green-200 text-sm mt-0.5">{selectedHoles.length}개 홀 상세 기록</p>
      </div>

      <div className="px-4 py-5 space-y-4 pb-28 overflow-y-auto flex-1">
        {selectedHoles.map(hole => (
          <HoleCard key={hole.hole_number} hole={hole} />
        ))}
      </div>
    </div>
  );
}
