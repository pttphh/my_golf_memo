import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round, Hole } from '../types';

interface Props {
  onRoundSelect?: (round: Round) => void;
}

interface RoundWithHoles {
  round: Round;
  holes: Hole[];
  totalStrokes: number;
  totalPar: number;
  overPar: number;
  totalPutts: number;
  threePuttPlus: number;
  penalties: number;
  gir: number;
  fairwayHits: number;
  fairwayDenom: number;
  doubleOrWorse: number;
}

const PENALTY_MAP: Record<string, number> = { OB: 2, '해저드': 1 };

function computeHoleStats(holes: Hole[]) {
  const totalStrokes = holes.reduce((s, h) => s + h.total_strokes, 0);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const overPar = totalStrokes - totalPar;
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const threePuttPlus = holes.filter(h => h.putts >= 3).length;
  const doubleOrWorse = holes.filter(h => h.over_par >= 2).length;
  const penalties = holes.reduce((s, h) => {
    let pen = 0;
    for (const p of [h.tee_penalty_type, h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      pen += PENALTY_MAP[p] ?? 0;
    }
    return s + pen;
  }, 0);
  // GIR: 1번째 세컨샷이 '그린 온 (GIR)' 이거나 par3 티샷이 그린 온(GIR)인 경우만
  const gir = holes.filter(h => {
    const req = h.par - 2;
    return h.green_shots <= req && h.green_shots > 0;
  }).length;
  const fairwayDenom = holes.filter(h => h.par !== 3).length;
  const fairwayHits = holes.filter(h => h.par !== 3 && h.tee_result === '페어웨이').length;
  return { totalStrokes, totalPar, overPar, totalPutts, threePuttPlus, penalties, gir, fairwayHits, fairwayDenom, doubleOrWorse };
}

function shortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length >= 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  return dateStr;
}

function MiniChart({ label, values, color, unit, higherIsBetter = false }: {
  label: string;
  values: { date: string; v: number }[];
  color: string;
  unit?: string;
  higherIsBetter?: boolean;
}) {
  const max = Math.max(...values.map(v => v.v), 1);
  const textColor = color.includes('green') ? 'text-[#1a6b3a]'
    : color.includes('orange') ? 'text-orange-600'
    : color.includes('red') ? 'text-red-500'
    : 'text-blue-500';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">{label}</h3>
      <div className="space-y-1.5">
        {values.map(({ date, v }) => (
          <div key={date} className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 w-8 flex-shrink-0">{date}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${textColor}`}>
              {unit === '%' ? `${v}%` : `${v}${unit ?? ''}`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between text-[10px] text-gray-400">
        <span>최신</span>
        <span className={textColor}>
          {higherIsBetter ? '높을수록 좋음' : '낮을수록 좋음'}
        </span>
      </div>
    </div>
  );
}

export default function AllRounds({ onRoundSelect }: Props) {
  const [data, setData] = useState<RoundWithHoles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(20);

      if (!rounds || rounds.length === 0) { setLoading(false); return; }

      const { data: allHoles } = await supabase
        .from('holes')
        .select('*')
        .in('round_id', rounds.map(r => r.id));

      const holesMap: Record<string, Hole[]> = {};
      for (const h of (allHoles ?? [])) {
        if (!holesMap[h.round_id]) holesMap[h.round_id] = [];
        holesMap[h.round_id].push(h as Hole);
      }

      const result: RoundWithHoles[] = rounds.map(r => {
        const holes = (holesMap[r.id] ?? []).sort((a, b) => a.hole_number - b.hole_number);
        const stats = computeHoleStats(holes);
        return { round: r as Round, holes, ...stats };
      });

      setData(result);
      setLoading(false);
    }
    load();
  }, []);

  const last6 = data.slice(0, 6);
  const chronological = [...last6].reverse();

  const avgScore = last6.length > 0 ? Math.round(last6.reduce((s, d) => s + d.totalStrokes, 0) / last6.length) : 0;
  const avgOver = last6.length > 0
    ? Math.round((last6.reduce((s, d) => s + d.overPar, 0) / last6.length) * 10) / 10
    : 0;

  const allBestData = data.length > 0 ? data.reduce((best, d) => d.totalStrokes < best.totalStrokes ? d : best) : null;
  const last6BestData = last6.length > 0 ? last6.reduce((best, d) => d.totalStrokes < best.totalStrokes ? d : best) : null;

  // Average miss per round TOP3
  const missCountMap: Record<string, number> = {};
  const roundCount = last6.length;
  for (const d of last6) {
    const seen = new Set<string>();
    for (const h of d.holes) {
      for (const raw of [h.tee_miss, h.second1_miss, h.second2_miss, h.second3_miss, h.approach1_miss, h.approach2_miss]) {
        if (!raw) continue;
        for (const m of raw.split(',').map(s => s.trim()).filter(Boolean)) {
          seen.add(m);
        }
      }
    }
    for (const m of seen) {
      missCountMap[m] = (missCountMap[m] ?? 0) + 1;
    }
  }
  const top3Miss = Object.entries(missCountMap)
    .map(([type, total]) => ({ type, avg: roundCount > 0 ? Math.round((total / roundCount) * 10) / 10 : 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);
  const maxMissAvg = top3Miss[0]?.avg ?? 1;

  // Score trend data
  const maxScore = chronological.length > 0 ? Math.max(...chronological.map(d => d.totalStrokes)) : 100;
  const minScore = chronological.length > 0 ? Math.min(...chronological.map(d => d.totalStrokes)) : 80;
  const scoreRange = maxScore - minScore || 1;

  // 4 trend charts
  const fairwayValues = chronological.map(d => ({
    date: shortDate(d.round.date),
    v: d.fairwayDenom > 0 ? Math.round((d.fairwayHits / d.fairwayDenom) * 100) : 0,
  }));
  const girValues = chronological.map(d => ({ date: shortDate(d.round.date), v: d.gir }));
  const putt3Values = chronological.map(d => ({ date: shortDate(d.round.date), v: d.threePuttPlus }));
  const penaltyValues = chronological.map(d => ({ date: shortDate(d.round.date), v: d.penalties }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#1a6b3a] text-white px-4 pt-4 pb-5">
        <h2 className="text-xl font-bold">전체 통계</h2>
        <p className="text-green-200 text-sm mt-0.5">최근 6라운드 기준</p>
      </div>

      <div className="px-4 py-5 space-y-5">
        {data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
            저장된 라운드가 없습니다
          </div>
        ) : (
          <>
            {/* Average summary — single card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">평균 오버파</p>
                <p className={`text-4xl font-extrabold leading-none ${avgOver >= 0 ? 'text-red-500' : 'text-[#1a6b3a]'}`}>
                  {avgOver >= 0 ? `+${avgOver}` : avgOver}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">평균 스코어</p>
                <p className="text-2xl font-bold text-gray-700">{avgScore}<span className="text-sm font-normal text-gray-400 ml-1">타</span></p>
              </div>
            </div>

            {/* Score trend bar chart */}
            {chronological.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">스코어 추이</h3>
                <div className="flex items-end gap-2 h-28">
                  {chronological.map(d => {
                    const height = ((d.totalStrokes - minScore) / scoreRange) * 60 + 20;
                    const over = d.overPar;
                    const barColor = over > 10 ? 'bg-red-400' : over > 5 ? 'bg-yellow-400' : 'bg-[#1a6b3a]';
                    return (
                      <div key={d.round.id} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[11px] font-bold text-gray-700">{d.totalStrokes}</span>
                        <div className={`w-full rounded-t-lg transition-all ${barColor}`} style={{ height: `${height}px` }} />
                        <span className="text-[10px] text-gray-400 leading-tight text-center">{shortDate(d.round.date)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2x2 trend charts */}
            {chronological.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <MiniChart label="페어웨이 안착률" values={fairwayValues} color="bg-[#1a6b3a]" unit="%" higherIsBetter />
                <MiniChart label="GIR" values={girValues} color="bg-blue-400" higherIsBetter />
                <MiniChart label="3퍼팅 이상" values={putt3Values} color="bg-orange-400" />
                <MiniChart label="벌타 손실" values={penaltyValues} color="bg-red-400" unit="타" />
              </div>
            )}

            {/* Average miss TOP3 */}
            {top3Miss.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">미스 유형 TOP 3</h3>
                <p className="text-[11px] text-gray-400 mb-3">라운드 평균 발생 횟수</p>
                <div className="space-y-3">
                  {top3Miss.map(({ type, avg }, i) => (
                    <div key={type}>
                      <div className="flex justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold text-white ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-red-400' : 'bg-red-300'}`}>{i + 1}</span>
                          <span className="text-sm text-gray-700">{type}</span>
                        </div>
                        <span className="text-sm font-bold text-red-500">평균 {avg}회</span>
                      </div>
                      <div className="h-2 bg-red-50 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(avg / maxMissAvg) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best scores */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">베스트 스코어</h3>
              <div className="space-y-2">
                {allBestData && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Trophy size={14} className="text-yellow-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-700 leading-none">올타임 최저</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{allBestData.round.course_name} · {allBestData.round.date}</p>
                      </div>
                    </div>
                    <span className="font-extrabold text-gray-900 ml-3 flex-shrink-0">{allBestData.totalStrokes}타</span>
                  </div>
                )}
                {last6BestData && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Trophy size={14} className="text-[#1a6b3a] flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-700 leading-none">최근 6라운드 최저</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{last6BestData.round.course_name} · {last6BestData.round.date}</p>
                      </div>
                    </div>
                    <span className="font-extrabold text-[#1a6b3a] ml-3 flex-shrink-0">{last6BestData.totalStrokes}타</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
