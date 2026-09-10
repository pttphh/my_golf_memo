import type { Hole } from '../types';

const PENALTY_MAP: Record<string, number> = { OB: 2, '해저드': 1 };

function allPenaltyFields(h: Hole): string[] {
  return [
    h.tee_penalty_type,
    h.tee2_penalty_type,
    h.second1_penalty_type,
    h.second2_penalty_type,
    h.second3_penalty_type,
    h.second4_penalty_type ?? '',
  ];
}

export function formatMMDD(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
  return dateStr.slice(5).replace('-', '/') || dateStr;
}

export function computeRoundPenaltyStrokes(holes: Hole[]): number {
  return holes.reduce((s, h) => {
    let pen = 0;
    for (const p of allPenaltyFields(h)) {
      pen += PENALTY_MAP[p] ?? 0;
    }
    return s + pen;
  }, 0);
}

/** 어프로치권 실패 판정 대상: 파4·파5 상세 기록 홀 */
export function isApproachZoneHole(h: Hole): boolean {
  return h.par !== 3 && !h.is_manual && Number(h.green_shots) > 0;
}

const APPROACH_ZONE_FAIL_TYPES = ['어프로치 불가', 'OB', '해저드'];

function secondPenaltyFields(h: Hole): string[] {
  return [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type, h.second4_penalty_type ?? ''];
}

/** 홀 하나의 어프로치권 실패 횟수 (온그린 타수 기반 추론 + 슬롯 명시값 중 큰 값) */
export function holeApproachZoneFails(h: Hole): number {
  if (!isApproachZoneHole(h)) return 0;
  const approachCount = [h.approach1_club, h.approach2_club, h.approach3_club].filter(Boolean).length;
  let penalty = 0;
  for (const p of allPenaltyFields(h)) penalty += PENALTY_MAP[p] ?? 0;
  const secondShots = Number(h.green_shots) - 1 - approachCount - penalty;
  const inferred = Math.max(0, secondShots - (h.par - 3));
  const explicit = secondPenaltyFields(h).filter(p => APPROACH_ZONE_FAIL_TYPES.includes(p)).length;
  return Math.max(inferred, explicit);
}

export function computeRoundApproachZoneFails(holes: Hole[]): number {
  return holes.reduce((s, h) => s + holeApproachZoneFails(h), 0);
}

export interface ApproachZoneFailBreakdown {
  total: number;
  approachNG: number;
  ob: number;
  hazard: number;
  recordedHoles: number;
}

export function computeRoundApproachZoneFailBreakdown(holes: Hole[]): ApproachZoneFailBreakdown {
  const out: ApproachZoneFailBreakdown = { total: 0, approachNG: 0, ob: 0, hazard: 0, recordedHoles: 0 };
  for (const h of holes) {
    if (!isApproachZoneHole(h)) continue;
    out.recordedHoles += 1;
    out.total += holeApproachZoneFails(h);
    for (const p of secondPenaltyFields(h)) {
      if (p === '어프로치 불가') out.approachNG += 1;
      else if (p === 'OB') out.ob += 1;
      else if (p === '해저드') out.hazard += 1;
    }
  }
  return out;
}

/** approach1~3 결과 기준 근접률 (추이 그래프용) */
export function computeRoundApproachTrendPct(holes: Hole[]): number {
  const results = holes.flatMap(h => [h.approach1_result, h.approach2_result, h.approach3_result]).filter(Boolean);
  if (results.length === 0) return 0;
  return Math.round((results.filter(r => r === '성공').length / results.length) * 100);
}

export function computeRoundApproachFailCount(holes: Hole[]): number {
  return holes.reduce((sum, h) =>
    sum
    + (h.approach1_result === '실패' ? 1 : 0)
    + (h.approach2_result === '실패' ? 1 : 0)
    + (h.approach3_result === '실패' ? 1 : 0),
    0,
  );
}

export function computeRoundShortPuttMissCount(holes: Hole[]): number {
  return holes.flatMap(h => [h.putt_miss, h.putt2_miss]).filter(v => v === '숏퍼팅 실패').length;
}

export function computeTeePenaltyStrokes(holes: Hole[]): number {
  return holes.reduce((s, h) => {
    let pen = 0;
    for (const p of [h.tee_penalty_type, h.tee2_penalty_type]) {
      pen += PENALTY_MAP[p] ?? 0;
    }
    return s + pen;
  }, 0);
}

export function computeFairwayPct(holes: Hole[]): number {
  const hits = holes.filter(h => h.par !== 3 && h.tee_result === '페어웨이').length;
  return Math.round((hits / 14) * 100);
}

export function computeGirCount(holes: Hole[]): number {
  const PEN: Record<string, number> = { OB: 2, '해저드': 1 };
  return holes.filter(h => {
    if (h.green_shots <= 0) return false;
    const pen = [h.tee_penalty_type, h.tee2_penalty_type, h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]
      .reduce((s, p) => s + (PEN[p] ?? 0), 0);
    return h.green_shots + pen <= h.par - 2;
  }).length;
}

export function computeWedgeSuccessRate(holes: Hole[]): number {
  let total = 0;
  let success = 0;
  for (const h of holes) {
    const clubs = [h.second1_club, h.second2_club, h.second3_club, h.second4_club];
    const results = [h.second1_result, h.second2_result, h.second3_result, h.second4_result];
    clubs.forEach((c, i) => {
      if (c?.includes('웨지')) {
        total++;
        if (results[i] === '그린 온(GIR)' || results[i] === '그린 온') success++;
      }
    });
  }
  return total > 0 ? Math.round((success / total) * 100) : 0;
}

export function computeApproach20Pct(holes: Hole[]): number {
  let total = 0;
  let success = 0;
  for (const h of holes) {
    const clubs = [h.approach1_club, h.approach2_club, h.approach3_club];
    const results = [h.approach1_result, h.approach2_result, h.approach3_result];
    clubs.forEach((c, i) => {
      if (c === '20m이내') {
        total++;
        if (results[i] === '성공') success++;
      }
    });
  }
  return total > 0 ? Math.round((success / total) * 100) : 0;
}


export function computeTotalPutts(holes: Hole[]): number {
  return holes.reduce((s, h) => s + (h.putts ?? 0), 0);
}

export function computeThreePuttCount(holes: Hole[]): number {
  return holes.filter(h => (h.putts ?? 0) >= 3).length;
}

export function computeShortPuttSuccessRate(holes: Hole[]): number {
  const slots = holes.flatMap(h => [h.putt_miss, h.putt2_miss]);
  const attempts = slots.filter(v => v === '숏퍼팅 성공' || v === '숏퍼팅 실패').length;
  if (attempts === 0) return 0;
  const success = slots.filter(v => v === '숏퍼팅 성공').length;
  return Math.round((success / attempts) * 100);
}

export function chartPointsAvg(points: { value: number }[]): number {
  if (points.length === 0) return 0;
  const sum = points.reduce((s, p) => s + p.value, 0);
  return Math.round((sum / points.length) * 10) / 10;
}

export function SegmentCardFootnote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] text-gray-400 border-t border-gray-100 pt-2 mt-3"
      style={{ borderTopWidth: 0.5, marginTop: 12, paddingTop: 8 }}
    >
      {children}
    </p>
  );
}

export function SegmentLineChart({
  points,
  lineColor,
  avgValue,
  caption,
  formatValue = (v: number) => `${v}`,
  yMin,
  yMax,
}: {
  points: { value: number; date: string }[];
  lineColor: string;
  avgValue: number;
  caption: string;
  formatValue?: (v: number) => string;
  yMin?: number;
  yMax?: number;
}) {
  if (points.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">데이터 없음</p>;
  }

  const values = points.map(p => p.value);
  const rawMin = Math.min(...values, avgValue);
  const rawMax = Math.max(...values, avgValue);
  const rawRange = rawMax - rawMin || 1;
  const pad = Math.max(rawRange * 0.4, rawMax * 0.1, 1);
  const minV = yMin !== undefined ? yMin : Math.max(0, rawMin - pad);
  const maxV = yMax !== undefined ? yMax : rawMax + pad;
  const range = maxV - minV || 1;
  const padX = 24;
  const chartW = 320 - padX * 2;
  const chartTop = 10;
  const chartBottom = 70;
  const chartH = chartBottom - chartTop;

  const toY = (v: number) => chartBottom - ((v - minV) / range) * chartH;
  const toX = (i: number) => padX + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);

  const linePoints = points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ');
  const avgY = toY(avgValue);

  return (
    <div>
      <svg viewBox="0 0 320 90" className="w-full h-auto">
        <line
          x1={padX}
          y1={avgY}
          x2={320 - padX}
          y2={avgY}
          stroke="#BA7517"
          strokeWidth={1}
          strokeDasharray="4"
        />
        <polyline fill="none" stroke={lineColor} strokeWidth={2} points={linePoints} />
        {points.map((p, i) => {
          const isLatest = i === points.length - 1;
          const cx = toX(i);
          const cy = toY(p.value);
          return (
            <g key={i}>
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize={9} fill="#374151">
                {formatValue(p.value)}
              </text>
              <circle cx={cx} cy={cy} r={isLatest ? 4 : 3} fill={lineColor} />
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between px-6 -mt-1">
        {points.map((p, i) => (
          <span
            key={i}
            className="text-[10px] text-gray-400"
            style={{ width: `${100 / points.length}%`, textAlign: 'center' }}
          >
            {formatMMDD(p.date)}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 text-center mt-2">{caption}</p>
    </div>
  );
}
