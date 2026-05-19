import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Hole } from '../types';
import { getScoreLabel } from '../types';

interface Props {
  roundId: string;
  onBack: () => void;
  onConfirm: (selectedIndices: number[]) => void;
  onEditHole: (holeNumber: number) => void;
  onContinue: (holeNumber: number) => void;
}

export default function HoleSelect({ roundId, onBack, onConfirm, onEditHole, onContinue }: Props) {
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

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

  const savedNums = new Set(holes.map(h => h.hole_number));
  const isComplete = holes.length >= 18;
  const nextHole = isComplete ? null : (
    holes.length === 0 ? 1 : Math.max(...holes.map(h => h.hole_number)) + 1
  );

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(holes.map((_, i) => i)));
  }

  function scoreColor(overPar: number) {
    if (overPar < 0) return 'text-blue-500';
    if (overPar === 0) return 'text-[#1a6b3a]';
    if (overPar === 1) return 'text-yellow-600';
    if (overPar === 2) return 'text-orange-500';
    return 'text-red-500';
  }

  function scoreBg(overPar: number, isSelected: boolean) {
    if (isSelected) return 'bg-[#1a6b3a] border-[#1a6b3a]';
    if (overPar < 0) return 'bg-blue-50 border-blue-200';
    if (overPar === 0) return 'bg-green-50 border-green-200';
    if (overPar === 1) return 'bg-yellow-50 border-yellow-200';
    if (overPar === 2) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  }

  const sortedIndices = Array.from(selected).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
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

      <div className="flex-1 px-4 py-5 space-y-4 pb-36">
        {/* 이어서 입력하기 버튼 */}
        {!isComplete && nextHole !== null && (
          <button
            onClick={() => onContinue(nextHole)}
            className="w-full flex items-center justify-between bg-[#1a6b3a] text-white px-4 py-3.5 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform shadow-lg shadow-green-900/20"
          >
            <span>{nextHole}번 홀부터 이어서 입력하기</span>
            <ChevronRight size={16} />
          </button>
        )}

        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">{selected.size}개 홀 선택 (상세 보기용)</p>
          {holes.length > 0 && (
            <button onClick={selectAll} className="text-xs text-[#1a6b3a] font-semibold active:opacity-70">전체 선택</button>
          )}
        </div>

        {holes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
            <p className="text-sm">저장된 홀 기록이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 18 }, (_, i) => i + 1).map(num => {
              const hole = holes.find(h => h.hole_number === num);
              const idx = holes.findIndex(h => h.hole_number === num);
              const isSelected = idx >= 0 && selected.has(idx);

              if (!hole) {
                return (
                  <div key={num} className="rounded-2xl border-2 border-dashed border-gray-200 p-3 text-center opacity-40">
                    <p className="text-xs font-semibold text-gray-400 mb-1">{num}홀</p>
                    <p className="text-sm text-gray-300">-</p>
                  </div>
                );
              }

              const overPar = hole.over_par;
              const overStr = overPar > 0 ? `+${overPar}` : overPar === 0 ? 'E' : `${overPar}`;

              return (
                <div key={num} className="relative">
                  <button
                    onClick={() => onEditHole(num)}
                    className={`w-full rounded-2xl border-2 p-3 text-center transition-all active:scale-95 ${scoreBg(overPar, isSelected)}`}
                  >
                    <p className={`text-xs font-semibold mb-0.5 ${isSelected ? 'text-white' : 'text-gray-500'}`}>{num}홀</p>
                    <p className={`text-lg font-extrabold leading-none ${isSelected ? 'text-white' : scoreColor(overPar)}`}>
                      {overStr}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>
                      {hole.total_strokes}타 / 파{hole.par}
                    </p>
                    <p className={`text-[9px] mt-1 font-medium ${isSelected ? 'text-green-100' : 'text-gray-300'}`}>탭하여 수정</p>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); idx >= 0 && toggle(idx); }}
                    className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'bg-white/80 border-gray-300'}`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-[#1a6b3a]" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-100 px-4 py-3 shadow-lg">
          <button
            onClick={() => onConfirm(sortedIndices)}
            className="w-full bg-[#1a6b3a] text-white py-4 rounded-2xl font-bold text-base active:scale-95 transition-transform shadow-lg shadow-green-900/20"
          >
            선택한 홀 상세 보기 ({selected.size}개)
          </button>
        </div>
      )}
    </div>
  );
}

void getScoreLabel;
