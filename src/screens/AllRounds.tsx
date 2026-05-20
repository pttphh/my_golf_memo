import { useEffect, useState } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { missPatternKey } from '../lib/missPattern';
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
  birdie: number;
  parHoles: number;
  bogey: number;
  double: number;
  triple: number;
}

const PENALTY_MAP: Record<string, number> = { OB: 2, '해저드': 1 };

function computeHoleStats(holes: Hole[]): Omit<RoundWithHoles, 'round' | 'holes'> {
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
  const gir = holes.filter(h => h.green_shots <= h.par - 2 && h.green_shots > 0).length;
  const fairwayDenom = holes.filter(h => h.par !== 3).length;
  const fairwayHits = holes.filter(h => h.par !== 3 && h.tee_result === '페어웨이').length;
  const birdie = holes.filter(h => h.over_par <= -1).length;
  const parHoles = holes.filter(h => h.over_par === 0).length;
  const bogey = holes.filter(h => h.over_par === 1).length;
  const double = holes.filter(h => h.over_par === 2).length;
  const triple = holes.filter(h => h.over_par >= 3).length;
  return { totalStrokes, totalPar, overPar, totalPutts, threePuttPlus, penalties, gir, fairwayHits, fairwayDenom, doubleOrWorse, birdie, parHoles, bogey, double, triple };
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

function avgInt(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export default function AllRounds({ onRoundSelect: _onRoundSelect }: Props) {
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
  const roundCount = last6.length;

  const allBestData = data.length > 0 ? data.reduce((best, d) => d.totalStrokes < best.totalStrokes ? d : best) : null;
  const last6BestData = last6.length > 0 ? last6.reduce((best, d) => d.totalStrokes < best.totalStrokes ? d : best) : null;

  // Miss analysis (패턴 단위: "풀, 훅" → "풀+훅" 1회)
  const missCountMap: Record<string, number> = {};
  const clubMissRaw: Record<string, number> = { '드라이버': 0, '아이언': 0, '어프로치': 0, '퍼터': 0 };

  for (const d of last6) {
    for (const h of d.holes) {
      for (const raw of [
        h.tee_miss, h.second1_miss, h.second2_miss, h.second3_miss,
        h.approach1_miss, h.approach2_miss, h.putt_miss,
      ]) {
        const key = missPatternKey(raw);
        if (key) missCountMap[key] = (missCountMap[key] ?? 0) + 1;
      }
      if (missPatternKey(h.tee_miss)) clubMissRaw['드라이버'] += 1;
      for (const raw of [h.second1_miss, h.second2_miss, h.second3_miss]) {
        if (missPatternKey(raw)) clubMissRaw['아이언'] += 1;
      }
      for (const raw of [h.approach1_miss, h.approach2_miss]) {
        if (missPatternKey(raw)) clubMissRaw['어프로치'] += 1;
      }
      if (missPatternKey(h.putt_miss)) clubMissRaw['퍼터'] += 1;
    }
  }

  const top3Miss = Object.entries(missCountMap)
    .map(([type, total]) => ({ type, avg: roundCount > 0 ? Math.round((total / roundCount) * 10) / 10 : 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  const topMiss = top3Miss[0];
  const clubMissAvg = (['드라이버', '아이언', '어프로치', '퍼터'] as const).map(club => ({
    club,
    avg: roundCount > 0 ? Math.round((clubMissRaw[club] / roundCount) * 10) / 10 : 0,
  }));
  const topClub = [...clubMissAvg].sort((a, b) => b.avg - a.avg)[0];
  const maxClubMiss = Math.max(...clubMissAvg.map(c => c.avg), 1);

  // Averages
  const avgOver = avg(last6.map(d => d.overPar));
  const avgScore = avgInt(last6.map(d => d.totalStrokes));
  const avgPutts = avg(last6.map(d => d.totalPutts));

  // Score distribution
  const avgBirdie = avg(last6.map(d => d.birdie));
  const avgPar = avg(last6.map(d => d.parHoles));
  const avgBogey = avg(last6.map(d => d.bogey));
  const avgDouble = avg(last6.map(d => d.double));
  const avgTriple = avg(last6.map(d => d.triple));
  const distMax = Math.max(avgBirdie, avgPar, avgBogey, avgDouble, avgTriple, 1);

  // Shot accuracy
  const avgFairway = last6.length > 0
    ? Math.round(last6.reduce((s, d) => s + (d.fairwayDenom > 0 ? d.fairwayHits / d.fairwayDenom : 0), 0) / last6.length * 100)
    : 0;
  const avgGir = avg(last6.map(d => d.gir));
  const avg3Putt = avg(last6.map(d => d.threePuttPlus));
  const avgDbl = avg(last6.map(d => d.doubleOrWorse));
  const avgPenalty = avg(last6.map(d => d.penalties));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#1a6b3a] text-white px-4 pb-5" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <h2 className="text-xl font-bold">전체 통계</h2>
        <p className="text-green-200 text-sm mt-0.5">최근 6라운드 기준</p>
      </div>

      <div className="px-4 py-5 space-y-4">
        {data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
            저장된 라운드가 없습니다
          </div>
        ) : (
          <>
            {/* ① 나의 개선 포인트 */}
            <div className="bg-[#e8f5ee] rounded-2xl border border-[#b6dfc8] p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-[#1a6b3a]" />
                <h3 className="text-sm font-bold text-[#1a6b3a]">나의 개선 포인트</h3>
              </div>
              {topMiss || (topClub && topClub.avg > 0) ? (
                <>
                  <p className="text-sm text-[#2d5a3d] leading-relaxed mb-3">
                    {topMiss && topClub && topClub.avg > 0
                      ? `"${topMiss.type}" 미스가 라운드당 평균 ${topMiss.avg}회 발생하고 있으며, ${topClub.club} 미스가 가장 많습니다. 집중 연습이 필요합니다.`
                      : topMiss
                      ? `"${topMiss.type}" 미스가 라운드당 평균 ${topMiss.avg}회 발생하고 있습니다.`
                      : `${topClub!.club} 미스가 가장 많이 발생하고 있습니다.`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {topMiss && (
                      <span className="px-3 py-1 bg-[#1a6b3a] text-white text-xs font-semibold rounded-full">#{topMiss.type}</span>
                    )}
                    {topClub && topClub.avg > 0 && (
                      <span className="px-3 py-1 bg-white border border-[#1a6b3a] text-[#1a6b3a] text-xs font-semibold rounded-full">#{topClub.club}</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">미스 데이터가 부족합니다. 홀 기록을 더 입력해보세요.</p>
              )}
            </div>

            {/* ② 최근 6라운드 평균 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">최근 6라운드 평균</h3>
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                <div className="text-center pr-2">
                  <p className="text-[11px] text-gray-400 mb-1">평균 오버파</p>
                  <p className={`text-2xl font-extrabold leading-none ${avgOver > 0 ? 'text-red-500' : avgOver < 0 ? 'text-[#1a6b3a]' : 'text-gray-700'}`}>
                    {avgOver > 0 ? `+${avgOver}` : avgOver === 0 ? 'E' : avgOver}
                  </p>
                </div>
                <div className="text-center px-2">
                  <p className="text-[11px] text-gray-400 mb-1">평균 타수</p>
                  <p className="text-2xl font-extrabold leading-none text-gray-800">{avgScore}<span className="text-xs font-normal text-gray-400 ml-0.5">타</span></p>
                </div>
                <div className="text-center pl-2">
                  <p className="text-[11px] text-gray-400 mb-1">평균 퍼팅</p>
                  <p className="text-2xl font-extrabold leading-none text-blue-500">{avgPutts}<span className="text-xs font-normal text-gray-400 ml-0.5">개</span></p>
                </div>
              </div>
            </div>

            {/* ③ 스코어 분포 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">스코어 분포 (라운드 평균 홀 수)</h3>
              <div className="space-y-2.5">
                {[
                  { label: '버디 이하', value: avgBirdie, color: 'bg-blue-500', textColor: 'text-blue-600' },
                  { label: '파', value: avgPar, color: 'bg-[#1a6b3a]', textColor: 'text-[#1a6b3a]' },
                  { label: '보기', value: avgBogey, color: 'bg-yellow-400', textColor: 'text-yellow-600' },
                  { label: '더블', value: avgDouble, color: 'bg-orange-400', textColor: 'text-orange-600' },
                  { label: '트리플+', value: avgTriple, color: 'bg-red-500', textColor: 'text-red-600' },
                ].map(({ label, value, color, textColor }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-14 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / distMax) * 100}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-8 text-right flex-shrink-0 ${textColor}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ④ 샷 정확도 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">샷 정확도</h3>
              <div className="space-y-3">
                {[
                  { label: '페어웨이 안착률', value: avgFairway, max: 100, display: `${avgFairway}%`, color: 'bg-[#1a6b3a]', textColor: 'text-[#1a6b3a]' },
                  { label: 'GIR', value: avgGir, max: 18, display: `${avgGir}홀`, color: 'bg-blue-400', textColor: 'text-blue-600' },
                  { label: '평균 퍼팅 수', value: avgPutts, max: 40, display: `${avgPutts}개`, color: 'bg-sky-400', textColor: 'text-sky-600' },
                  { label: '3퍼팅 이상', value: avg3Putt, max: 9, display: `${avg3Putt}홀`, color: 'bg-orange-400', textColor: 'text-orange-600' },
                  { label: '더블보기 이상', value: avgDbl, max: 9, display: `${avgDbl}홀`, color: 'bg-red-400', textColor: 'text-red-600' },
                  { label: '벌타 손실', value: avgPenalty, max: 10, display: `${avgPenalty}타`, color: 'bg-red-600', textColor: 'text-red-700' },
                ].map(({ label, value, max, display, color, textColor }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{label}</span>
                      <span className={`text-xs font-bold ${textColor}`}>{display}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ⑤ 미스 유형 TOP3 */}
            {top3Miss.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">미스 유형 TOP 3</h3>
                <p className="text-[11px] text-gray-400 mb-3">라운드 평균 발생 횟수</p>
                <div className="space-y-3">
                  {top3Miss.map(({ type, avg: a }, i) => (
                    <div key={type}>
                      <div className="flex justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold text-white ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-red-400' : 'bg-red-300'}`}>{i + 1}</span>
                          <span className="text-sm text-gray-700">{type}</span>
                        </div>
                        <span className="text-sm font-bold text-red-500">평균 {a}회</span>
                      </div>
                      <div className="h-2 bg-red-50 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(a / (top3Miss[0].avg || 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ⑥ 클럽별 미스 횟수 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">클럽별 미스 횟수</h3>
              <p className="text-[11px] text-gray-400 mb-3">라운드 평균</p>
              <div className="space-y-3">
                {clubMissAvg.map(({ club, avg: a }) => {
                  const ratio = a / maxClubMiss;
                  const barColor = ratio >= 0.75 ? 'bg-red-500' : ratio >= 0.5 ? 'bg-orange-400' : ratio >= 0.25 ? 'bg-yellow-400' : 'bg-[#1a6b3a]';
                  const textColor = ratio >= 0.75 ? 'text-red-600' : ratio >= 0.5 ? 'text-orange-600' : ratio >= 0.25 ? 'text-yellow-600' : 'text-[#1a6b3a]';
                  return (
                    <div key={club}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">{club}</span>
                        <span className={`text-xs font-bold ${textColor}`}>평균 {a}회</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${ratio * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ⑦ 베스트 스코어 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">베스트 스코어</h3>
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
