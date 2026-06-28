import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { missPatternKey } from '../lib/missPattern';
import type { Round, Hole } from '../types';
import {
  SegmentLineChart,
  SegmentCardFootnote,
  formatMMDD,
  computeRoundApproachTrendPct,
  computeRoundShortPuttMissCount,
  chartPointsAvg,
} from '../components/SegmentChart';

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

const PENALTY_MAP: Record<string, number> = { OB: 2, 해저드: 1 };

type FilterType = 'recent5' | 'recent10' | 'all';
type SegmentType = 'tee' | 'second' | 'approach' | 'putt';

const SEGMENTS: { id: SegmentType; label: string }[] = [
  { id: 'tee', label: '티샷' },
  { id: 'second', label: '세컨샷' },
  { id: 'approach', label: '어프로치' },
  { id: 'putt', label: '퍼팅' },
];

const MISS_BAR_COLORS = ['#E24B4A', '#E24B4A', '#EF9F27', '#EF9F27', '#B4B2A9'];

function computeHoleStats(holes: Hole[]): Omit<RoundWithHoles, 'round' | 'holes'> {
  const totalStrokes = holes.reduce((s, h) => s + h.total_strokes, 0);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const overPar = totalStrokes - totalPar;
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const threePuttPlus = holes.filter(h => h.putts >= 3).length;
  const doubleOrWorse = holes.filter(h => h.over_par >= 2).length;
  const penalties = holes.reduce((s, h) => {
    let pen = 0;
    for (const p of [h.tee_penalty_type, h.tee2_penalty_type, h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      pen += PENALTY_MAP[p] ?? 0;
    }
    return s + pen;
  }, 0);
  const gir = holes.filter(h => h.green_shots <= h.par - 2 && h.green_shots > 0).length;
  const fairwayDenom = 14;
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

function avgPerRound(filteredData: RoundWithHoles[], countFn: (holes: Hole[]) => number): number {
  if (filteredData.length === 0) return 0;
  const total = filteredData.reduce((s, d) => s + countFn(d.holes), 0);
  return Math.round((total / filteredData.length) * 10) / 10;
}


function roundFairwayPct(holes: Hole[]): number | null {
  const par45WithTee = holes.filter(h => h.par !== 3 && h.tee_result);
  if (par45WithTee.length === 0) return null;
  const hits = par45WithTee.filter(h => h.tee_result === '페어웨이').length;
  return Math.round((hits / 14) * 100);
}

function roundApproachFailCount(holes: Hole[]): number {
  return holes.filter(h => h.approach1_result === '실패').length;
}

function roundFatalMissCount(holes: Hole[]): number {
  return holes.reduce((sum, h) => {
    let count = 0;
    for (const p of [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      if (p === '어프로치 불가' || p === 'OB' || p === '해저드') count++;
    }
    return sum + count;
  }, 0);
}

function roundWedgeSuccessCount(holes: Hole[]): number {
  return holes.reduce((sum, h) => {
    let count = 0;
    const clubs = [h.second1_club, h.second2_club, h.second3_club];
    const results = [h.second1_result, h.second2_result, h.second3_result];
    for (let i = 0; i < 3; i++) {
      if (clubs[i]?.includes('웨지') && results[i] === '그린 온(GIR)') count++;
    }
    return sum + count;
  }, 0);
}

function pctFromTotals(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function avgPerRoundNullable(rounds: RoundWithHoles[], countFn: (holes: Hole[]) => number): number | null {
  if (rounds.length === 0) return null;
  const total = rounds.reduce((s, d) => s + countFn(d.holes), 0);
  return Math.round((total / rounds.length) * 10) / 10;
}

function roundAvgPutts(d: RoundWithHoles): number {
  const n = d.holes.length || 18;
  return Math.round((d.totalPutts / n) * 10) / 10;
}

function topMissBars(raws: string[], roundCount: number, limit = 5) {
  const counts: Record<string, number> = {};
  for (const raw of raws) {
    const key = missPatternKey(raw);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, total]) => ({
      type,
      avg: roundCount > 0 ? Math.round((total / roundCount) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, limit);
}

function MetricCell({ label, value, sub, valueClass = 'text-gray-800' }: {
  label: string; value: string; sub?: string; valueClass?: string;
}) {
  const subCls = valueClass === 'text-gray-300' ? 'text-gray-300' : 'text-gray-500';
  return (
    <div className="bg-gray-50 rounded-xl p-2 text-center">
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
      {sub && <p className={`text-[10px] ${subCls} mt-0.5 leading-tight`}>{sub}</p>}
      <p className="text-[10px] text-gray-500 mt-1 leading-tight">{label}</p>
    </div>
  );
}

function metricDisplay(
  value: number | null,
  format: (n: number) => string,
  valueClass = 'text-gray-800',
): { value: string; sub?: string; valueClass: string } {
  if (value === null) return { value: '–', sub: '미기록', valueClass: 'text-gray-300' };
  return { value: format(value), valueClass };
}

function RankedMissBarChart({ items }: { items: { type: string; avg: number }[] }) {
  const max = Math.max(...items.map(i => i.avg), 1);
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-2">데이터 없음</p>;
  }
  return (
    <div className="space-y-2.5">
      {items.map(({ type, avg: a }, idx) => (
        <div key={type} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-16 flex-shrink-0 truncate">{type}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(a / max) * 100}%`, backgroundColor: MISS_BAR_COLORS[idx] ?? '#B4B2A9' }}
            />
          </div>
          <span className="text-xs font-bold min-w-[32px] text-right text-gray-700">{a}회</span>
        </div>
      ))}
    </div>
  );
}

function ColoredBarChart({ items }: { items: { label: string; avg: number; color: string }[] }) {
  const max = Math.max(...items.map(i => i.avg), 1);
  return (
    <div className="space-y-2.5">
      {items.map(({ label, avg: a, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-16 flex-shrink-0">{label}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(a / max) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="text-xs font-bold min-w-[32px] text-right text-gray-700">{a}회</span>
        </div>
      ))}
    </div>
  );
}

export default function AllRounds({ onRoundSelect: _onRoundSelect }: Props) {
  const [data, setData] = useState<RoundWithHoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('recent5');
  const [activeSegment, setActiveSegment] = useState<SegmentType>('tee');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(20);

        
      if (!rounds || rounds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: allHoles } = await supabase
        .from('holes')
        .select('*')
        .in('round_id', rounds.map(r => r.id));

      const holesMap: Record<string, Hole[]> = {};
      for (const h of allHoles ?? []) {
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

  const detailedData = data.filter(d => d.round.is_detailed !== false);
  const filteredData =
    filter === 'recent5' ? detailedData.slice(0, 5) : filter === 'recent10' ? detailedData.slice(0, 10) : detailedData;
  const roundCount = filteredData.length;
  const allHoles = filteredData.flatMap(d => d.holes);

  const chart6 = [...detailedData.slice(0, 6)].reverse();

  const allBestData =
    data.length > 0 ? data.reduce((best, d) => (d.totalStrokes < best.totalStrokes ? d : best)) : null;
  const filteredBestData =
    filteredData.length > 0
      ? filteredData.reduce((best, d) => (d.totalStrokes < best.totalStrokes ? d : best))
      : null;

  const avgOver = avg(filteredData.map(d => d.overPar));
  const avgScore = avgInt(filteredData.map(d => d.totalStrokes));
  const avgPutts = avg(filteredData.map(d => d.totalPutts));
  const avgPenalty = avg(filteredData.map(d => d.penalties));

  const avgBirdie = avg(filteredData.map(d => d.birdie));
  const avgPar = avg(filteredData.map(d => d.parHoles));
  const avgBogey = avg(filteredData.map(d => d.bogey));
  const avgDouble = avg(filteredData.map(d => d.double));
  const avgTriple = avg(filteredData.map(d => d.triple));
  const distMax = Math.max(avgBirdie, avgPar, avgBogey, avgDouble, avgTriple, 1);

  const validGIRRounds = filteredData.filter(d =>
    d.holes.filter(h => h.second1_result).length > 0,
  );
  const validFatalRounds = validGIRRounds;
  const validWedgeRounds = filteredData.filter(d =>
    d.holes.filter(h =>
      [h.second1_club, h.second2_club, h.second3_club].some(c => c?.includes('웨지')),
    ).length > 0,
  );

  const periodHoles = filteredData.flatMap(d => d.holes);

  const avgFairway = pctFromTotals(
    periodHoles.filter(h => h.par !== 3 && h.tee_result === '페어웨이').length,
    periodHoles.filter(h => h.par !== 3 && h.tee_result).length,
  );
  const avgGir = validGIRRounds.length > 0
    ? Math.round((validGIRRounds.reduce((s, d) => s + d.gir, 0) / validGIRRounds.length) * 10) / 10
    : null;
  const avg3PuttPlus = avg(filteredData.map(d => d.threePuttPlus));

  const avgCriticalMiss = avgPerRoundNullable(validFatalRounds, roundFatalMissCount);
  const avgWedgeSuccess = avgPerRoundNullable(validWedgeRounds, roundWedgeSuccessCount);
  const avgApproachSuccess = pctFromTotals(
    periodHoles.filter(h => h.approach1_result === '성공' || h.approach2_result === '성공').length,
    periodHoles.filter(h => h.approach1_club === '20m이내').length,
  );  );
  const avgShortPuttSuccess = pctFromTotals(
    periodHoles.filter(h => h.putt_miss === '숏퍼팅 성공').length,
    periodHoles.filter(h => h.putt_miss).length,
  );

  const approach20Success = periodHoles.filter(h => h.approach1_club === '20m이내' && h.approach1_result === '성공').length;
  const approach20Total = periodHoles.filter(h => h.approach1_club === '20m이내').length;
  const avgApproachFail = avgPerRound(filteredData, roundApproachFailCount);

  const avg1Putt = avgPerRound(filteredData, holes => holes.filter(h => h.putts === 1).length);
  const avg2Putt = avgPerRound(filteredData, holes => holes.filter(h => h.putts === 2).length);
  const avg3Putt = avgPerRound(filteredData, holes => holes.filter(h => h.putts === 3).length);
  const avg4PuttPlus = avgPerRound(filteredData, holes => holes.filter(h => h.putts >= 4).length);

  const teeMissBars = topMissBars(allHoles.map(h => h.tee_miss).filter(Boolean), roundCount);
  const secondMissBars = topMissBars(
    allHoles.flatMap(h => [h.second1_miss, h.second2_miss, h.second3_miss].filter(Boolean)),
    roundCount,
  );
  const approachMissBars = topMissBars(
    allHoles.flatMap(h => [h.approach1_miss, h.approach2_miss].filter(Boolean)),
    roundCount,
  );

  const chart6Fairway = chart6.map(d => ({ value: roundFairwayPct(d.holes) ?? 0, date: d.round.date }));
  const chart6CriticalMiss = chart6.map(d => ({ value: roundFatalMissCount(d.holes), date: d.round.date }));
  const chart6ApproachSuccess = chart6.map(d => ({
    value: computeRoundApproachTrendPct(d.holes),
    date: d.round.date,
  }));
  const chart6ApproachFail = chart6.map(d => ({ value: roundApproachFailCount(d.holes), date: d.round.date }));
  const chart6ShortPuttMiss = chart6.map(d => ({
    value: computeRoundShortPuttMissCount(d.holes),
    date: d.round.date,
  }));
  const chart6Putts = chart6.map(d => ({ value: roundAvgPutts(d), date: d.round.date }));
  const avgChartApproachSuccess = chartPointsAvg(chart6ApproachSuccess);
  const avgChartShortPuttMiss = chartPointsAvg(chart6ShortPuttMiss);
  const avgChartPutts =
    chart6Putts.length > 0
      ? Math.round((chart6Putts.reduce((s, p) => s + p.value, 0) / chart6Putts.length) * 10) / 10
      : 0;

  const trendMax = Math.max(...chart6.map(d => d.totalStrokes), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9f9f7] flex items-center justify-center">
        <div className="text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9f7] flex flex-col">
      <div className="px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
        <h2 className="text-xl font-bold text-gray-900">통계</h2>
      </div>

      <div className="px-4 pb-28 space-y-4">
        {data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
            저장된 라운드가 없습니다
          </div>
        ) : (
          <>
            {/* 스코어 흐름 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">스코어 흐름</h3>
              <div className="flex items-end justify-between gap-1.5 min-h-[80px]">
                {chart6.map((d, idx) => {
                  const isLatest = idx === chart6.length - 1;
                  const barH = Math.max(20, Math.min(52, (d.totalStrokes / trendMax) * 52));
                  return (
                    <div key={d.round.id} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-700 leading-none">{d.totalStrokes}</span>
                      <div
                        className={`w-full rounded-t-md ${isLatest ? 'bg-[#1D9E75]' : 'bg-[#B5D4F4]'}`}
                        style={{ height: `${barH}px` }}
                      />
                      <span className="text-[10px] text-gray-400 leading-none truncate w-full text-center">
                        {formatMMDD(d.round.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-3">막대가 낮을수록 좋은 스코어</p>
            </div>

            {/* 기간 탭 */}
            <div className="bg-gray-100 rounded-full p-1 flex">
              {(
                [
                  { id: 'recent5' as const, label: '최근 5R' },
                  { id: 'recent10' as const, label: '최근 10R' },
                  { id: 'all' as const, label: '전체' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex-1 py-2 px-3 rounded-full text-sm font-medium transition-all ${
                    filter === id ? 'bg-[#1B4332] text-white shadow-sm' : 'text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 핵심 지표 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">핵심 지표</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-500 mb-1">평균 타수</p>
                  <p className="text-2xl font-extrabold text-gray-800">{avgScore}타</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-500 mb-1">평균 오버파</p>
                  <p className={`text-2xl font-extrabold ${avgOver > 0 ? 'text-red-500' : avgOver < 0 ? 'text-[#1B4332]' : 'text-gray-700'}`}>
                    {avgOver > 0 ? `+${avgOver}` : avgOver === 0 ? 'E' : avgOver}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-500 mb-1">평균 퍼팅</p>
                  <p className="text-2xl font-extrabold text-blue-500">{avgPutts}개</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-500 mb-1">평균 벌타</p>
                  <p className="text-2xl font-extrabold text-red-500">{avgPenalty}타</p>
                </div>
              </div>
            </div>

            {/* 홀 스코어 분포 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">스코어 분포 (라운드 평균 홀 수)</h3>
              <div className="space-y-2.5">
                {[
                  { label: '버디 이하', value: avgBirdie, color: 'bg-blue-500', textColor: 'text-blue-600' },
                  { label: '파', value: avgPar, color: 'bg-[#1B4332]', textColor: 'text-[#1B4332]' },
                  { label: '보기', value: avgBogey, color: 'bg-yellow-400', textColor: 'text-yellow-600' },
                  { label: '더블', value: avgDouble, color: 'bg-orange-400', textColor: 'text-orange-600' },
                  { label: '트리플+', value: avgTriple, color: 'bg-red-500', textColor: 'text-red-600' },
                ].map(({ label, value, color, textColor }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / distMax) * 100}%` }} />
                    </div>
                    <span className={`text-xs font-bold min-w-[32px] text-right flex-shrink-0 ${textColor}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 구간별 분석 */}
            <p className="text-xs text-gray-500 px-1">구간별 분석</p>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {SEGMENTS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveSegment(id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    activeSegment === id
                      ? 'bg-[#1B4332] text-white border-[#1B4332]'
                      : 'border-gray-200 text-gray-600 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeSegment === 'tee' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">티샷</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(() => {
                    const d = metricDisplay(avgFairway, v => `${v}%`, 'text-amber-600');
                    return <MetricCell label="페어웨이 안착률" value={d.value} sub={d.sub} valueClass={d.valueClass} />;
                  })()}
                  <MetricCell label="평균 벌타" value={`${avgPenalty}타`} valueClass="text-red-500" />
                </div>
                <p className="text-xs font-semibold text-gray-500 mb-2">페어웨이 안착률 추이</p>
                <SegmentLineChart
                  points={chart6Fairway}
                  lineColor="#1D9E75"
                  avgValue={avgFairway ?? 0}
                  caption="페어웨이 안착률 추이 · 최근 6라운드"
                  formatValue={v => `${v}%`}
                  yMin={0}
                  yMax={100}
                />
                <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                <RankedMissBarChart items={teeMissBars} />
                <SegmentCardFootnote>* 평균 벌타는 OB 1회 = 2타, 해저드 1회 = 1타로 계산합니다</SegmentCardFootnote>
              </div>
            )}

            {activeSegment === 'second' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">세컨샷</h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(() => {
                    const d = metricDisplay(avgGir, v => `${v}홀`, 'text-blue-500');
                    return <MetricCell label="평균 GIR" value={d.value} sub={d.sub} valueClass={d.valueClass} />;
                  })()}
                  {(() => {
                    const d = metricDisplay(avgCriticalMiss, v => `${v}`, 'text-red-500');
                    return <MetricCell label="평균 치명미스" value={d.value} sub={d.sub} valueClass={d.valueClass} />;
                  })()}
                  {(() => {
                    const d = metricDisplay(avgWedgeSuccess, v => `${v}`, 'text-amber-600');
                    return <MetricCell label="평균 웨지 온 성공" value={d.value} sub={d.sub} valueClass={d.valueClass} />;
                  })()}
                </div>
                <p className="text-xs font-semibold text-gray-500 mb-2">치명미스 추이</p>
                <SegmentLineChart
                  points={chart6CriticalMiss}
                  lineColor="#E24B4A"
                  avgValue={avgCriticalMiss ?? 0}
                  caption="치명미스 추이 · 최근 6라운드 (낮을수록 좋음)"
                  formatValue={v => `${v}`}
                  yMin={0}
                />
                <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                <RankedMissBarChart items={secondMissBars} />
                <SegmentCardFootnote>
                  * 치명미스: 세컨샷 후 40m 이내의 어프로치 불가 또는 OB, 해저드로 이어진 경우
                </SegmentCardFootnote>
              </div>
            )}

            {activeSegment === 'approach' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">어프로치</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(() => {
                    const d = metricDisplay(avgApproachSuccess, v => `${v}%`, 'text-[#1B4332]');
                    return <MetricCell label="어프로치 성공률" value={d.value} sub={d.sub} valueClass={d.valueClass} />;
                  })()}
                  <MetricCell label="20m이내 2m안착" value={approach20Total === 0 ? '–' : `${Math.round((approach20Success / approach20Total) * 100)}%`} valueClass="text-teal-600" />
                </div>
                                <p className="text-xs font-semibold text-gray-500 mb-2">어프로치 성공률 추이</p>
                <SegmentLineChart
                  points={chart6ApproachSuccess}
                  lineColor="#1D9E75"
                  avgValue={avgChartApproachSuccess}
                  caption="어프로치 성공률 추이 · 최근 6라운드 (높을수록 좋음)"
                  formatValue={v => `${v}%`}
                  yMin={0}
                  yMax={100}
                />
                <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">실패 추이</p>
                <SegmentLineChart
                  points={chart6ApproachFail}
                  lineColor="#E24B4A"
                  avgValue={avgApproachFail}
                  caption="어프로치 실패 추이 · 최근 6라운드 (낮을수록 좋음)"
                  formatValue={v => `${v}`}
                  yMin={0}
                />
                <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                <RankedMissBarChart items={approachMissBars} />
                <SegmentCardFootnote>
                * 어프로치 성공률: 20m이내 2m안착 기준
                                </SegmentCardFootnote>
              </div>
            )}

            {activeSegment === 'putt' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">퍼팅</h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <MetricCell label="평균 퍼팅" value={`${avgPutts}`} valueClass="text-blue-500" />
                  <MetricCell label="3퍼팅 이상" value={`${avg3PuttPlus}홀`} valueClass="text-red-500" />
                  {(() => {
                    const d = metricDisplay(avgShortPuttSuccess, v => `${v}%`, 'text-amber-600');
                    return <MetricCell label="숏퍼팅 성공률" value={d.value} sub={d.sub} valueClass={d.valueClass} />;
                  })()}
                </div>
                <p className="text-xs font-semibold text-gray-500 mb-2">숏퍼팅 미스 추이</p>
                <SegmentLineChart
                  points={chart6ShortPuttMiss}
                  lineColor="#E24B4A"
                  avgValue={avgChartShortPuttMiss}
                  caption="숏퍼팅 미스 추이 · 최근 6라운드 (낮을수록 좋음)"
                  formatValue={v => `${v}`}
                  yMin={0}
                />
                <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">평균 퍼팅 추이</p>
                <SegmentLineChart
                  points={chart6Putts}
                  lineColor="#378ADD"
                  avgValue={avgChartPutts}
                  caption="평균 퍼팅 수 추이 · 최근 6라운드 (낮을수록 좋음)"
                  formatValue={v => `${v}`}
                />
                <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">홀별 퍼팅 분포</p>
                <ColoredBarChart
                  items={[
                    { label: '1퍼팅', avg: avg1Putt, color: '#1D9E75' },
                    { label: '2퍼팅', avg: avg2Putt, color: '#378ADD' },
                    { label: '3퍼팅', avg: avg3Putt, color: '#EF9F27' },
                    { label: '4퍼팅+', avg: avg4PuttPlus, color: '#E24B4A' },
                  ]}
                />
                <SegmentCardFootnote>* 숏퍼팅: 2m 이내 홀인 퍼팅</SegmentCardFootnote>
              </div>
            )}

            {/* 베스트 스코어 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">베스트 스코어</h3>
              <div className="space-y-2">
                {allBestData && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Trophy size={14} className="text-yellow-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-700 leading-none">올타임 최저</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {allBestData.round.course_name} · {allBestData.round.date}
                        </p>
                      </div>
                    </div>
                    <span className="font-extrabold text-gray-900 ml-3 flex-shrink-0">
                      {allBestData.totalStrokes}타
                    </span>
                  </div>
                )}
                {filteredBestData && filter === 'recent5' && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Trophy size={14} className="text-[#1B4332] flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-700 leading-none">최근 5라운드 최저</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {filteredBestData.round.course_name} · {filteredBestData.round.date}
                        </p>
                      </div>
                    </div>
                    <span className="font-extrabold text-[#1B4332] ml-3 flex-shrink-0">
                      {filteredBestData.totalStrokes}타
                    </span>
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
