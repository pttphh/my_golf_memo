import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Hole } from '../types';

interface Props {
  roundId: string;
  onBack: () => void;
}

interface MissEntry {
  label: string;
  count: number;
}

const DIRECTION = new Set(['풀', '훅', '푸쉬', '슬라이스']);
const CONTACT = new Set(['뒤땅', '탑볼', '뽕샷', '생크', '벙커 실패']);
const APPROACH_MISS = new Set(['오버', '숏', '닫힘', '열림', '뒤땅', '탑볼', '생크', '벙커 실패', '기타']);

function parseMissRaw(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function collectDirectionMisses(raws: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const raw of raws) {
    const parts = parseMissRaw(raw).filter(p => DIRECTION.has(p));
    if (parts.length === 0) continue;
    const key = parts.sort().join('+');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function collectContactMisses(raws: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const raw of raws) {
    const parts = parseMissRaw(raw).filter(p => CONTACT.has(p));
    for (const p of parts) {
      counts[p] = (counts[p] ?? 0) + 1;
    }
  }
  return counts;
}

function collectGenericMisses(raws: string[], validSet: Set<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const raw of raws) {
    const parts = parseMissRaw(raw).filter(p => validSet.has(p));
    for (const p of parts) {
      counts[p] = (counts[p] ?? 0) + 1;
    }
  }
  return counts;
}

function toEntries(counts: Record<string, number>): MissEntry[] {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function MissBar({ entry, max }: { entry: MissEntry; max: number }) {
  const pct = max > 0 ? (entry.count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-gray-700 shrink-0">{entry.label}</span>
      <div className="flex-1 h-2.5 bg-red-50 rounded-full overflow-hidden">
        <div className="h-full bg-red-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-bold text-red-600 shrink-0">{entry.count}회</span>
    </div>
  );
}

function CategorySection({ title, sub, entries }: { title: string; sub: string; entries: MissEntry[] }) {
  const max = entries[0]?.count ?? 1;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-bold text-[#1B4332] mb-0.5">{title}</h3>
      <p className="text-[11px] text-gray-500 mb-3">{sub}</p>
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
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-gray-500 text-sm">불러오는 중..</p>
      </div>
    );
  }

  const teeMisses = [
    ...holes.map(h => h.tee_miss),
    ...holes.filter(h => h.par === 5).map(h => h.second1_miss),
  ];
  const secondMisses = [
    ...holes.filter(h => h.par !== 5).map(h => h.second1_miss),
    ...holes.map(h => h.second2_miss),
    ...holes.map(h => h.second3_miss),
  ];
  const approachMisses = [
    ...holes.map(h => h.approach1_miss),
    ...holes.map(h => h.approach2_miss),
  ];

  const teeDirection = toEntries(collectDirectionMisses(teeMisses));
  const teeContact = toEntries(collectContactMisses(teeMisses));
  const secondDirection = toEntries(collectDirectionMisses(secondMisses));
  const secondContact = toEntries(collectContactMisses(secondMisses));
  const approachAll = toEntries(collectGenericMisses(approachMisses, APPROACH_MISS));

  const shortPuttFail = holes.filter(h => h.putt_miss === '숏퍼팅 실패' || h.putt2_miss === '숏퍼팅 실패').length;

  const totalMisses =
    teeDirection.reduce((s, e) => s + e.count, 0) +
    teeContact.reduce((s, e) => s + e.count, 0) +
    secondDirection.reduce((s, e) => s + e.count, 0) +
    secondContact.reduce((s, e) => s + e.count, 0) +
    approachAll.reduce((s, e) => s + e.count, 0) +
    shortPuttFail;

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <div className="bg-[#1B4332] text-white px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <button onClick={onBack} className="flex items-center gap-1 text-green-200 text-sm mb-3 active:opacity-70">
          <ChevronLeft size={16} />
          라운드 요약으로
        </button>
        <h2 className="text-xl font-bold">미스 유형 집계</h2>
        <p className="text-green-200 text-sm mt-1">{holes.length}홀 · 총 {totalMisses}회 미스</p>
      </div>

      <div className="px-4 py-5 space-y-4 pb-28 overflow-y-auto flex-1">
        {totalMisses === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
            기록된 미스가 없어요
          </div>
        ) : (
          <>
            <CategorySection
              title="티샷 방향 미스"
              sub="풀 · 훅 · 푸쉬 · 슬라이스 (복수 선택 시 조합으로 집계)"
              entries={teeDirection}
            />
            <CategorySection
              title="티샷 컨택 미스"
              sub="뒤땅 · 탑볼 · 뽕샷 (각각 집계)"
              entries={teeContact}
            />
            <CategorySection
              title="세컨샷 방향 미스"
              sub="풀 · 훅 · 푸쉬 · 슬라이스 (복수 선택 시 조합으로 집계)"
              entries={secondDirection}
            />
            <CategorySection
              title="세컨샷 컨택 미스"
              sub="뒤땅 · 탑볼 · 생크 · 벙커 실패 (각각 집계)"
              entries={secondContact}
            />
            <CategorySection
              title="어프로치 미스"
              sub="오버 · 숏 · 닫힘 · 열림 · 뒤땅 · 탑볼 · 생크"
              entries={approachAll}
            />
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-[#1B4332] mb-0.5">퍼팅 미스</h3>
              <p className="text-[11px] text-gray-500 mb-3">숏퍼팅 실패 집계</p>
              {shortPuttFail === 0 ? (
                <p className="text-sm text-gray-400">미스 없음</p>
              ) : (
                <div className="space-y-3">
                  <MissBar entry={{ label: '숏퍼팅 실패', count: shortPuttFail }} max={shortPuttFail} />
                </div>
              )}
            </div>
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