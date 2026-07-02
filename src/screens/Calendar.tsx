import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round } from '../types';

// 15일 창 라운드 수 → 색 (0~5+). 밝은 배경은 같은 계열 어두운 글자, 빨강/차콜은 흰 글자.
const DENSITY: { bg: string; text: string }[] = [
  { bg: 'transparent', text: '' },      // 0
  { bg: '#D3D1C7', text: '#2C2C2A' },   // 1 회색
  { bg: '#FAC775', text: '#412402' },   // 2 노랑
  { bg: '#C0DD97', text: '#173404' },   // 3 녹색
  { bg: '#E24B4A', text: '#FFFFFF' },   // 4 빨강
  { bg: '#4B4A46', text: '#FFFFFF' },   // 5+ 차콜
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  onRoundSelect: (round: Round) => void;
  onCreateRound: (date: string) => void;
}

export default function Calendar({ onRoundSelect, onCreateRound }: Props) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from('rounds').select('*').eq('user_id', user.id);
      setRounds((data ?? []) as Round[]);
      setLoading(false);
    })();
  }, []);

  // 날짜별 라운드 목록
  const byDate = new Map<string, Round[]>();
  for (const r of rounds) {
    if (!r.date) continue;
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  // 그 날 ±7일(총 15일) 창 안의 라운드 기록 수
  function windowCount(d: Date): number {
    let c = 0;
    for (let off = -7; off <= 7; off++) {
      const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off);
      c += byDate.get(toKey(dd))?.length ?? 0;
    }
    return c;
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toKey(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  function goMonth(delta: number) {
    setCursor(new Date(year, month + delta, 1));
  }

  function handleTap(d: Date) {
    const list = byDate.get(toKey(d));
    if (list && list.length > 0) onRoundSelect(list[0]);
    else onCreateRound(toKey(d));
  }

  return (
    <div className="min-h-dvh pb-28" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="px-4 pt-2 pb-3">
        <h1 className="text-lg font-bold text-gray-800">일정</h1>
        <p className="text-xs text-gray-400 mt-0.5">라운드 밀도를 색으로 보여줍니다 (±7일 기준)</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between px-4 mb-3">
        <button onClick={() => goMonth(-1)} aria-label="이전 달"
          className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 active:scale-90 transition-transform">
          <ChevronLeft size={18} />
        </button>
        <p className="text-base font-bold text-gray-800">{year}년 {MONTHS[month]}</p>
        <button onClick={() => goMonth(1)} aria-label="다음 달"
          className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 active:scale-90 transition-transform">
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-10">불러오는 중...</p>
      ) : (
        <div className="px-3">
          {/* Weekday row */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-[11px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, idx) => {
              if (!d) return <div key={`b${idx}`} className="aspect-square" />;
              const key = toKey(d);
              const level = Math.min(windowCount(d), 5);
              const color = DENSITY[level];
              const hasRound = (byDate.get(key)?.length ?? 0) > 0;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  onClick={() => handleTap(d)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center relative active:scale-90 transition-transform ${isToday ? 'ring-2 ring-[#1B4332]' : ''}`}
                  style={{
                    backgroundColor: color.bg,
                    color: level === 0 ? '#6B7280' : color.text,
                  }}
                >
                  <span className="text-sm font-semibold leading-none">{d.getDate()}</span>
                  {hasRound && (
                    <Flag size={9} className="mt-0.5" strokeWidth={2.5}
                      style={{ color: level >= 4 ? '#FFFFFF' : '#1B4332' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-5 bg-white rounded-2xl border border-gray-100 p-3">
            <p className="text-[11px] font-medium text-gray-500 mb-2">15일 창 안 라운드 수</p>
            <div className="flex items-center justify-between gap-1">
              {[
                { n: '1', c: '#D3D1C7' },
                { n: '2', c: '#FAC775' },
                { n: '3', c: '#C0DD97' },
                { n: '4', c: '#E24B4A' },
                { n: '5+', c: '#4B4A46' },
              ].map(item => (
                <div key={item.n} className="flex flex-col items-center gap-1">
                  <div className="w-7 h-7 rounded-md" style={{ backgroundColor: item.c }} />
                  <span className="text-[10px] text-gray-500">{item.n}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
              깃발 표시된 날에 라운드 기록이 있습니다. 날짜를 탭하면 기록된 라운드 요약으로, 빈 날은 그 날짜로 새 라운드 만들기로 이동합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
