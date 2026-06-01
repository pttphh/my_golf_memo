import type { Hole } from '../types';

const PENALTY_MAP: Record<string, number> = { OB: 2, '해저드': 1 };

function allPenaltyFields(h: Hole): string[] {
  return [
    h.tee_penalty_type,
    h.tee2_penalty_type,
    h.second1_penalty_type,
    h.second2_penalty_type,
    h.second3_penalty_type,
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

export function computeRoundFatalMissCount(holes: Hole[]): number {
  return holes.reduce((sum, h) => {
    let count = 0;
    for (const p of [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      if (p === '어프로치 불가' || p === 'OB' || p === '해저드') count++;
    }
    return sum + count;
  }, 0);
}

/** 20m이내·20~40m approach1 기준 성공률 (추이 그래프용) */
export function computeRoundApproachTrendPct(holes: Hole[]): number {
  const attempts = holes.filter(h => h.approach1_club === '20m이내' || h.approach1_club === '20~40m');
  if (attempts.length === 0) return 0;
  return Math.round((attempts.filter(h => h.approach1_result === '성공').length / attempts.length) * 100);
}

export function computeRoundShortPuttMissCount(holes: Hole[]): number {
  return holes.filter(h => h.putt_miss === '숏퍼팅 실패').length;
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
  const minV = yMin ?? Math.min(...values, avgValue);
  const maxV = yMax ?? Math.max(...values, avgValue);
  const range = maxV - minV || 1;
  const padX = 24;
  const chartW = 320 - padX * 2;
  const chartTop = 14;
  const chartBottom = 58;
  const chartH = chartBottom - chartTop;

  const toY = (v: number) => chartBottom - ((v - minV) / range) * chartH;
  const toX = (i: number) => padX + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);

  const linePoints = points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ');
  const avgY = toY(avgValue);

  return (
    <div>
      <svg viewBox="0 0 320 80" className="w-full h-auto">
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
