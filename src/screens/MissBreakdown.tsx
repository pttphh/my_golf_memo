import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Hole } from '../types';

interface Props {
  roundId: string;
  onBack: () => void;
}

type Counts = Record<string, number>;
interface Entry { label: string; count: number; }

function parseMissTokens(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function comboLabel(raw: string): string | null {
  const t = parseMissTokens(raw);
  if (t.length === 0) return null;
  return t.slice().sort().join('+');
}

function addCombo(counts: Counts, raw: string) {
  const label = comboLabel(raw);
  if (!label) return;
  counts[label] = (counts[label] ?? 0) + 1;
}

function toEntries(counts: Counts): Entry[] {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function clubCategory(club: string): 'driver' | 'woodutil' | 'iron' | 'wedge' | null {
  if (club === '드라이버') return 'driver';
  if (club === '우드' || club === '유틸') return 'woodutil';
  if (club === '아이언') return 'iron';
  if (club === '웨지') return 'wedge';
  return null;
}

const PIE_COLORS = ['#E24B4A', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, rO: number, rI: number, s: number, e: number): string {
  const [x1, y1] = polar(cx, cy, rO, s);
  const [x2, y2] = polar(cx, cy, rO, e);
  const [x3, y3] = polar(cx, cy, rI, e);
  const [x4, y4] = polar(cx, cy, rI, s);
  const large = e - s > 180 ? 1 : 0;
  return `M${x1} ${y1} A${rO} ${rO} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${rI} ${rI} 0 ${large} 0 ${x4} ${y4} Z`;
}

function MissBar({ entry, max }: { entry: Entry; max: number }) {
  const pct = max > 0 ? (entry.count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-gray-700 shrink-0">{entry.label}</span>
      <div className="flex-1 h-2.5 bg-red-50 rounded-full overflow-hidden">
        <div className="h-full bg-red-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-bold text-red-600 shrink-0">{entry.count}회</span>
    </div>
  );
}

function CategorySection({ title, entries }: { title: string; entries: Entry[] }) {
  const max = entries[0]?.count ?? 1;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-bold text-[#1B4332] mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">미스 없음</p>
      ) : (
        <div className="space-y-3">
          {entries.map(e => <MissBar key={e.label} entry={e} max={max} />)}
        </div>
      )}
    </div>
  );
}

export default function MissBreakdown({ roundId, onBack }: Props) {
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

  if (loading) {
    return (
      <div className="min-h-dvh bg-surface flex items-center justify-center">
        <p className="text-gray-500 text-sm">불러오는 중..</p>
      </div>
    );
  }

  const driver: Counts = {};
  const woodutil: Counts = {};
  const iron: Counts = {};
  const wedge: Counts = {};
  const approach: Counts = {};
  const pie: Counts = {};
  let puttFail = 0;

  for (const h of holes) {
    const swingSlots: [string, string][] = [
      [h.tee_club, h.tee_miss],
      [h.tee2_club, h.tee2_miss],
      [h.second1_club, h.second1_miss],
      [h.second2_club, h.second2_miss],
      [h.second3_club, h.second3_miss],
      [h.second4_club ?? '', h.second4_miss ?? ''],
    ];
    for (const [club, miss] of swingSlots) {
      const cat = clubCategory(club);
      if (cat === 'driver') addCombo(driver, miss);
      else if (cat === 'woodutil') addCombo(woodutil, miss);
      else if (cat === 'iron') addCombo(iron, miss);
      else if (cat === 'wedge') addCombo(wedge, miss);
    }

    for (const raw of [
      h.tee_miss, h.tee2_miss,
      h.second1_miss, h.second2_miss, h.second3_miss, h.second4_miss ?? '',
      h.approach1_miss, h.approach2_miss, h.approach3_miss ?? '',
    ]) {
      addCombo(pie, raw);
    }

    addCombo(approach, h.approach1_miss);
    addCombo(approach, h.approach2_miss);
    addCombo(approach, h.approach3_miss ?? '');

    if (h.putt_miss === '숏퍼팅 실패') puttFail++;
    if (h.putt2_miss === '숏퍼팅 실패') puttFail++;
  }

  const pieEntries = toEntries(pie);
  const pieTotal = pieEntries.reduce((s, e) => s + e.count, 0);
  const totalAll = pieTotal + puttFail;

  let acc = 0;
  const slices = pieEntries.map((e, i) => {
    const start = pieTotal > 0 ? (acc / pieTotal) * 360 : 0;
    acc += e.count;
    const end = pieTotal > 0 ? (acc / pieTotal) * 360 : 0;
    return { ...e, start, end, color: PIE_COLORS[i % PIE_COLORS.length] };
  });

  const putterEntries: Entry[] = puttFail > 0 ? [{ label: '숏퍼팅 실패', count: puttFail }] : [];

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <div className="bg-[#1B4332] text-white px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <button onClick={onBack} className="flex items-center gap-1 text-green-200 text-sm mb-3 active:opacity-70">
          <ChevronLeft size={16} />
          라운드 요약으로
        </button>
        <h2 className="text-xl font-bold">미스 유형 집계</h2>
        <p className="text-green-200 text-sm mt-1">{holes.length}홀 · 총 {totalAll}회 미스</p>
      </div>

      <div className="px-4 py-5 space-y-4 pb-28 overflow-y-auto flex-1">
        {totalAll === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
            기록된 미스가 없어요
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-[#1B4332] mb-1">전체 스윙 미스</h3>
              <p className="text-[11px] text-gray-500 mb-3">채 구분 없이 미스 종류별 · 퍼팅 제외</p>
              {pieTotal === 0 ? (
                <p className="text-sm text-gray-400">스윙 미스 없음</p>
              ) : (
                <div className="flex flex-col items-center">
                  <svg viewBox="0 0 200 200" className="w-44 h-44">
                    {slices.map(s => (
                      <path key={s.label} d={arcPath(100, 100, 80, 48, s.start, s.end)} fill={s.color} />
                    ))}
                    {slices.map(s => {
                      if (s.end - s.start < 18) return null;
                      const mid = (s.start + s.end) / 2;
                      const [tx, ty] = polar(100, 100, 64, mid);
                      return (
                        <text key={s.label + '-t'} x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="#ffffff">
                          {s.count}
                        </text>
                      );
                    })}
                    <text x="100" y="94" textAnchor="middle" fontSize="12" fill="#6B7280">합계</text>
                    <text x="100" y="114" textAnchor="middle" fontSize="20" fontWeight="800" fill="#1B4332">{pieTotal}회</text>
                  </svg>
                  <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4">
                    {slices.map(s => (
                      <div key={s.label + '-l'} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-xs text-gray-600 flex-1 truncate">{s.label}</span>
                        <span className="text-xs font-bold text-gray-800">{s.count}회</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <CategorySection title="드라이버" entries={toEntries(driver)} />
            <CategorySection title="우드 & 유틸" entries={toEntries(woodutil)} />
            <CategorySection title="아이언" entries={toEntries(iron)} />
            <CategorySection title="웨지" entries={toEntries(wedge)} />
            <CategorySection title="웨지 - 어프로치" entries={toEntries(approach)} />
            <CategorySection title="퍼터" entries={putterEntries} />
          </>
        )}

        <button onClick={onBack}
          className="w-full bg-[#1B4332] text-white py-4 rounded-2xl font-bold text-base active:scale-95 transition-transform">
          라운드 요약으로 돌아가기
        </button>
      </div>
    </div>
  );
}
