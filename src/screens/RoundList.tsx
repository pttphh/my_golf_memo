import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Round } from '../types';

interface Props {
  onRoundSelect: (round: Round) => void;
}

interface RoundSummary {
  round: Round;
  totalStrokes: number;
  overPar: number;
  threePuttPlus: number;
  gir: number;
  penalties: number;
}

export default function RoundList({ onRoundSelect }: Props) {
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
        .select('round_id, par, total_strokes, putts, green_shots, tee_penalty_type, second1_penalty_type, second2_penalty_type, second3_penalty_type')
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
        const gir = hs.filter(h => h.green_shots > 0 && h.green_shots <= h.par - 2).length;
        const penalties = hs.reduce((s, h) => {
          let pen = 0;
          for (const p of [h.tee_penalty_type, h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
            if (p === 'OB') pen += 2;
            else if (p === '해저드') pen += 1;
          }
          return s + pen;
        }, 0);
        return { round: r as Round, totalStrokes, overPar: totalStrokes - totalPar, threePuttPlus, gir, penalties };
      }));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-3">
      {rounds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">저장된 라운드가 없습니다</p>
          <p className="text-gray-300 text-xs mt-1">새 라운드를 시작해보세요</p>
        </div>
      ) : (
        rounds.map(s => {
          const over = s.overPar;
          const overStr = over > 0 ? `+${over}` : over === 0 ? 'E' : `${over}`;
          const hasData = s.totalStrokes > 0;
          return (
            <button
              key={s.round.id}
              onClick={() => onRoundSelect(s.round)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{s.round.course_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.round.date} · {s.round.time}</p>
                </div>
                <div className="ml-4 text-right flex-shrink-0">
                  <p className="text-2xl font-extrabold text-gray-900 leading-none">
                    {hasData ? `${s.totalStrokes}타` : '-'}
                  </p>
                  <p className={`text-sm font-semibold mt-0.5 ${over > 0 ? 'text-red-500' : over < 0 ? 'text-[#1a6b3a]' : 'text-gray-500'}`}>
                    {hasData ? overStr : '기록 없음'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-0 mt-3 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-400">3퍼팅+</p>
                  <p className="text-sm font-bold text-orange-500 mt-0.5">{s.threePuttPlus}회</p>
                </div>
                <div className="text-center border-x border-gray-100">
                  <p className="text-xs text-gray-400">GIR</p>
                  <p className="text-sm font-bold text-[#1a6b3a] mt-0.5">{s.gir}/18</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">벌타</p>
                  <p className="text-sm font-bold text-red-500 mt-0.5">{s.penalties}타</p>
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
