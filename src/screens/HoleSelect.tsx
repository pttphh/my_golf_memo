import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Hole } from '../types';

interface Props {
  roundId: string;
  onBack: () => void;
  onConfirm: (selectedIndices: number[]) => void;
  onEditHole: (holeNumber: number) => void;
  onContinue: (holeNumber: number) => void;
}

function getPenalties(hole: Hole): { ob: boolean; hazard: boolean } {
  let ob = false;
  let hazard = false;
  for (const p of [
    hole.tee_penalty_type,
    hole.second1_penalty_type,
    hole.second2_penalty_type,
    hole.second3_penalty_type,
  ]) {
    if (p === 'OB') ob = true;
    if (p === '해저드') hazard = true;
  }
  return { ob, hazard };
}

function scoreColor(overPar: number) {
  if (overPar < 0) return 'text-blue-500';
  if (overPar === 0) return 'text-[#1a6b3a]';
  if (overPar === 1) return 'text-yellow-600';
  if (overPar === 2) return 'text-orange-500';
  return 'text-red-500';
}

function scoreBg(overPar: number) {
  if (overPar < 0) return 'bg-blue-50 border-blue-200';
  if (overPar === 0) return 'bg-green-50 border-green-200';
  if (overPar === 1) return 'bg-yellow-50 border-yellow-200';
  if (overPar === 2) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

export default function HoleSelect({ roundId, onBack, onConfirm: _onConfirm, onEditHole, onContinue }: Props) {
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('holes')
        .select('*')
        .eq('round_id', roundId)
        .order('hole_number');
      setHoles((data ?? []) as Hole[]);
      setLoading(false);
    }
    load();
  }, [roundId]);

  const isComplete = holes.length >= 18;
  const nextHole = isComplete ? null : (
    holes.length === 0 ? 1 : Math.max(...holes.map(h => h.hole_number)) + 1
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  function renderGrid(start: number, end: number) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(num => {
          const hole = holes.find(h => h.hole_number === num);

          if (!hole) {
            return (
              <button
                key={num}
                onClick={() => onEditHole(num)}
                className="rounded-2xl border-2 border-dashed border-gray-300 p-3 text-center active:scale-95 transition-all hover:border-[#1a6b3a] hover:bg-green-50"
              >
                <p className="text-xs font-semibold text-gray-400 mb-1">{num}홀</p>
                <p className="text-sm text-gray-300 mb-1">-</p>
                <p className="text-[9px] text-gray-300">탭하여 입력</p>
              </button>
            );
          }

          const overPar = hole.over_par;
          const overStr = overPar > 0 ? `+${overPar}` : overPar === 0 ? '파' : `${overPar}`;
          const { ob, hazard } = getPenalties(hole);

          return (
            <button
              key={num}
              onClick={() => onEditHole(num)}
              className={`w-full rounded-2xl border-2 p-3 text-center transition-all active:scale-95 ${scoreBg(overPar)}`}
            >
              <p className="text-xs font-semibold text-gray-500 mb-0.5">{num}홀</p>
              <p className={`text-lg font-extrabold leading-none ${scoreColor(overPar)}`}>
                {overStr}
              </p>
              <p className="text-[10px] mt-1 text-gray-400">
                {hole.green_shots}온 · {hole.putts}퍼팅
              </p>
              {(ob || hazard) && (
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {ob && <span className="text-[9px] font-bold text-red-500">OB</span>}
                  {ob && hazard && <span className="text-[9px] text-gray-300">·</span>}
                  {hazard && <span className="text-[9px] font-bold text-orange-500">해저드</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#1a6b3a] text-white px-4 pt-4 pb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-green-200 text-sm mb-3 active:opacity-70">
          <ChevronLeft size={16} /> 뒤로
        </button>
        <h2 className="text-xl font-bold">홀 기록</h2>
        <p className="text-green-200 text-sm mt-0.5">
          {isComplete ? '18홀 완료' : `${holes.length}홀 저장됨`}
          {!isComplete && holes.length > 0 && ` · ${nextHole}홀부터 이어서 입력 가능`}
        </p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 pb-8">
        {!isComplete && nextHole !== null && (
          <button
            onClick={() => onContinue(nextHole)}
            className="w-full flex items-center justify-between bg-[#1a6b3a] text-white px-4 py-3.5 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform shadow-lg shadow-green-900/20"
          >
            <span>{nextHole}번 홀부터 이어서 입력하기</span>
            <ChevronRight size={16} />
          </button>
        )}

        <p className="text-sm text-gray-400">각 홀을 탭하여 수정할 수 있어요</p>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-gray-500">전반 (1-9홀)</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {renderGrid(1, 9)}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-gray-500">후반 (10-18홀)</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {renderGrid(10, 18)}
        </div>
      </div>
    </div>
  );
}
