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

function parseMiss(raw: string): string[] {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function collectMisses(raws: string[], canonicalOrder: string[]): MissEntry[] {
  const counts: Record<string, number> = {};
  for (const raw of raws) {
    if (!raw) continue;
    const items = parseMiss(raw);
    if (items.length === 0) continue;
    if (items.length === 1) {
      counts[items[0]] = (counts[items[0]] ?? 0) + 1;
    } else {
      const sorted = [...items].sort((a, b) => {
        const ai = canonicalOrder.indexOf(a);
        const bi = canonicalOrder.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      const key = sorted.join('+');
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

const TEE_DIRECTION = ['풀', '훅', '푸쉬', '슬라이스'];
const TEE_CONTACT = ['뒤땅', '탑볼', '뽕샷', '기타'];
const SECOND_DIRECTION = ['풀', '훅', '푸쉬', '슬라이스'];
const SECOND_CONTACT = ['뒤땅', '탑볼', '생크', '벙커 실패', '기타'];
const APPROACH_ALL = ['오버', '숏', '뒤땅', '탑볼', '생크', '벙커 실패', '기타'];
const PUTT_ALL = ['숏퍼팅 미스', '거리감 미스'];

function filterEntries(entries: MissEntry[], canonicalItems: string[]): MissEntry[] {
  return entries.filter(e => {
    const parts = e.label.split('+');
    return parts.every(p => canonicalItems.includes(p));
  });
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

function CategorySection({ title, entries }: { title: string; entries: MissEntry[] }) {
  const max = entries[0]?.count ?? 1;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-bold text-gray-600 mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-300">기록 없음</p>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  const teeMisses = holes.map(h => h.tee_miss);
  const secondMisses = [
    ...holes.map(h => h.second1_miss),
    ...holes.map(h => h.second2_miss),
    ...holes.map(h => h.second3_miss),
  ];
  const approachMisses = [
    ...holes.map(h => h.approach1_miss),
    ...holes.map(h => h.approach2_miss),
  ];
  const puttMisses = holes.map(h => h.putt_miss);

  const teeAll = collectMisses(teeMisses, [...TEE_DIRECTION, ...TEE_CONTACT]);
  const secondAll = collectMisses(secondMisses, [...SECOND_DIRECTION, ...SECOND_CONTACT]);
  const approachAll = collectMisses(approachMisses, APPROACH_ALL);
  const puttAll = collectMisses(puttMisses, PUTT_ALL);

  const teeDirection = filterEntries(teeAll, TEE_DIRECTION);
  const teeContact = filterEntries(teeAll, TEE_CONTACT);
  const teeDirectionFull = [
    ...teeDirection,
    ...teeAll.filter(e => {
      const parts = e.label.split('+');
      return parts.some(p => TEE_DIRECTION.includes(p)) && parts.some(p => TEE_CONTACT.includes(p));
    }),
  ].sort((a, b) => b.count - a.count);

  const secondDirection = filterEntries(secondAll, SECOND_DIRECTION);
  const secondContact = filterEntries(secondAll, SECOND_CONTACT);
  const secondDirectionFull = [
    ...secondDirection,
    ...secondAll.filter(e => {
      const parts = e.label.split('+');
      return parts.some(p => SECOND_DIRECTION.includes(p)) && parts.some(p => SECOND_CONTACT.includes(p));
    }),
  ].sort((a, b) => b.count - a.count);

  const totalMisses =
    teeAll.reduce((s, e) => s + e.count, 0) +
    secondAll.reduce((s, e) => s + e.count, 0) +
    approachAll.reduce((s, e) => s + e.count, 0) +
    puttAll.reduce((s, e) => s + e.count, 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#1a6b3a] text-white px-4 pt-10 pb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-green-200 text-sm mb-3 active:opacity-70">
          <ChevronLeft size={16} />
          라운드 요약으로
        </button>
        <h2 className="text-xl font-bold">미스 유형 집계</h2>
        <p className="text-green-200 text-sm mt-1">{holes.length}홀 · 총 {totalMisses}회 미스</p>
      </div>

      <div className="px-4 py-5 space-y-4">
        {totalMisses === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
            기록된 미스가 없습니다
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-[#1a6b3a] mb-1">방향 미스</h3>
              <p className="text-[11px] text-gray-400 mb-3">티샷 · 세컨샷 방향 미스 합산</p>
              {(teeDirectionFull.length === 0 && secondDirectionFull.length === 0) ? (
                <p className="text-sm text-gray-300">기록 없음</p>
              ) : (
                <div className="space-y-4">
                  {teeDirectionFull.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">티샷</p>
                      <div className="space-y-3">
                        {teeDirectionFull.map(e => <MissBar key={e.label} entry={e} max={teeDirectionFull[0].count} />)}
                      </div>
                    </div>
                  )}
                  {secondDirectionFull.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">세컨샷</p>
                      <div className="space-y-3">
                        {secondDirectionFull.map(e => <MissBar key={e.label} entry={e} max={secondDirectionFull[0].count} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-[#1a6b3a] mb-1">컨택 미스</h3>
              <p className="text-[11px] text-gray-400 mb-3">티샷 · 세컨샷 컨택 미스 합산</p>
              {(teeContact.length === 0 && secondContact.length === 0) ? (
                <p className="text-sm text-gray-300">기록 없음</p>
              ) : (
                <div className="space-y-4">
                  {teeContact.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">티샷</p>
                      <div className="space-y-3">
                        {teeContact.map(e => <MissBar key={e.label} entry={e} max={teeContact[0].count} />)}
                      </div>
                    </div>
                  )}
                  {secondContact.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">세컨샷</p>
                      <div className="space-y-3">
                        {secondContact.map(e => <MissBar key={e.label} entry={e} max={secondContact[0].count} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <CategorySection title="어프로치 미스" entries={approachAll} />
            <CategorySection title="퍼팅 미스" entries={puttAll} />
          </>
        )}

        <button onClick={onBack}
          className="w-full bg-[#1a6b3a] text-white py-4 rounded-2xl font-bold text-base active:scale-95 transition-transform">
          라운드 요약으로 돌아가기
        </button>
      </div>
    </div>
  );
}
