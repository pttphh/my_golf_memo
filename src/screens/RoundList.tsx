import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round } from '../types';

interface Props {
  onRoundSelect: (round: Round) => void;
  onIncompleteRoundSelect: (round: Round) => void;
  onAddRound: () => void;
}

interface RoundSummary {
  round: Round;
  totalStrokes: number;
  overPar: number;
  threePuttPlus: number;
  doubleOrWorse: number;
  penalties: number;
  holeCount: number;
}

export default function RoundList({ onRoundSelect, onIncompleteRoundSelect, onAddRound }: Props) {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: roundRows } = await supabase
        .from('rounds')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(50);

      if (!roundRows || roundRows.length === 0) { setLoading(false); return; }

      const { data: allHoles } = await supabase
        .from('holes')
        .select('round_id, par, total_strokes, over_par, putts, tee_penalty_type, second1_penalty_type, second2_penalty_type, second3_penalty_type')
        .in('round_id', roundRows.map(r => r.id));

      type HoleRow = typeof allHoles extends (infer T)[] | null ? T : never;
      const holesMap: Record<string, HoleRow[]> = {};
      for (const h of (allHoles ?? [])) {
        if (!holesMap[h.round_id]) holesMap[h.round_id] = [];
        holesMap[h.round_id].push(h);
      }

      setRounds(roundRows.map(r => {
        const hs = holesMap[r.id] ?? [];
        const totalStrokes = hs.reduce((s, h) => s + h.total_strokes, 0);
        const totalPar = hs.reduce((s, h) => s + h.par, 0);
        const threePuttPlus = hs.filter(h => h.putts >= 3).length;
        const doubleOrWorse = hs.filter(h => h.over_par >= 2).length;
        const penalties = hs.reduce((s, h) => {
          let pen = 0;
          for (const p of [h.tee_penalty_type, h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
            if (p === 'OB') pen += 2;
            else if (p === '해저드') pen += 1;
          }
          return s + pen;
        }, 0);
        return { round: r as Round, totalStrokes, overPar: totalStrokes - totalPar, threePuttPlus, doubleOrWorse, penalties, holeCount: hs.length };
      }));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-gray-500 text-sm">불러오는 중..</p>
      </div>
    );
  }

  return (
    <div
      className="px-4 pb-28 space-y-3"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-[#1B4332] flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white" />
        </div>
        <span className="text-base font-bold text-gray-800 tracking-tight">Golf Memo</span>
      </div>

      {/* Add Round Button */}
      <button
        onClick={onAddRound}
        className="w-full flex items-center justify-center gap-2 py-5 bg-[#1B4332] text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform shadow-sm"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span>+ 라운드 기록 추가하기</span>
      </button>

      {rounds.length === 0 ? (
        <div className="bg-card rounded-2xl border border-gray-100 p-10 text-center mt-4">
          <p className="text-gray-500 text-sm">저장된 라운드가 없어요</p>
          <p className="text-gray-500 text-xs mt-1">라운드를 추가해보세요</p>
        </div>
      ) : (
        rounds.map(s => {
          const over = s.overPar;
          const overStr = over > 0 ? `+${over}` : over === 0 ? 'E' : `${over}`;
          const hasData = s.totalStrokes > 0;
          const isComplete = s.holeCount >= 18;
          return (
            <button
              key={s.round.id}
              onClick={() => isComplete ? onRoundSelect(s.round) : onIncompleteRoundSelect(s.round)}
              className="w-full rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-left active:scale-[0.98] transition-transform"
            >
              {/* Top Section - Light Green */}
              <div className="bg-[#f0f4f0] px-4 py-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800 truncate text-base">{s.round.course_name}</p>
                      {!isComplete && (
                        <span className="flex-shrink-0 text-[10px] font-semibold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">
                          {s.holeCount}/18홀
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.round.date} · {s.round.time}</p>
                  </div>
                  <div className="ml-4 text-right flex-shrink-0">
                    <p className="text-2xl font-extrabold text-gray-900 leading-none">
                      {hasData ? `${s.totalStrokes}타` : '-'}
                    </p>
                    <p className={`text-sm font-semibold mt-0.5 ${over > 0 ? 'text-red-500' : over < 0 ? 'text-[#1B4332]' : 'text-gray-500'}`}>
                      {hasData ? overStr : '기록 없음'}
                    </p>
                  </div>
                </div>
              </div>
              {/* Bottom Section - White */}
              <div className="bg-white px-4 py-3">
                <div className="grid grid-cols-3 gap-0">
                  <di