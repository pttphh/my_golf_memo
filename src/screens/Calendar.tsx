import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round } from '../types';

const PLANNED_KEY = 'golf_planned_dates';

// 15일 창 안 활성 날짜 수 → 색 (0~5+). 밝은 배경은 같은 계열 어두운 글자, 빨강/차콜은 흰 글자.
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

function loadPlanned(): string[] {
  try {
    const raw = localStorage.getItem(PLANNED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface Props {
  onRoundSelect: (round: Round) => void;
}

export default function Calendar({ onRoundSelect }: Props) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [planned, setPlanned] = useState<string[]>(() => loadPlanned());
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

  useEffect(() => {
    try { localStorage.setItem(PLANNED_KEY, JSON.stringify(planned)); } catch { /* noop */ }
  }, [planned]);

  // 날짜별 기록된 라운드
  const byDate = new Map<string, Round[]>();
  for (const r of rounds) {
    if (!r.date) continue;
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }
  const plannedSet = new Set(planned);

  // 활성 날짜 = 기록 라운드 OR 예정. 창 안 '고유 날짜' 수(같은 날 둘 다 있어도 1로 카운트).
  function windowCount(d: Date): number {
    let c = 0;
    for (let off = -7; off <= 7; off++) {
      const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off);
      const k = toKey(dd);
      if (byDate.has(k) || plannedSet.has(k)) c++;
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
    const k = toKey(d);
    const list = byDate.get(k);
    if (list && list.length > 0) {
      onRoundSelect(list[0]); // 기록된 라운드 → 그 날 라운드 요약으로 이동
      return;
    }
    // 예정 토글: 없으면 추가, 있으면 삭제
    setPlanned(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]));
  }

  return (
    <div className="min-h-dvh pb-28" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
      <div className="px-4 pt-2 pb-3">
        <h1 className="text-lg font-bold text-gray-800">일정</h1>
        <p className="text-xs text-gray-400 mt-0.5">라운드 밀도를 색으로 보여줍니다 (±7일 기준)</p>
      </div>

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
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-[11px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, idx) => {
              if (!d) return <div key={`b${idx}`} className="min-h-[64px]" />;
              const k = toKey(d);
              const level = Math.min(windowCount(d), 5);
              const color = DENSITY[level];
              const dayRounds = byDate.get(k) ?? [];
              const hasRound = dayRounds.length > 0;
              const isPlanned = plannedSet.has(k) && !hasRound;
              const isToday = k === todayKey;
              const textColor = level === 0 ? '#6B7280' : color.text;
              const courseName = hasRound ? (dayRounds[0].course_name || '') : '';
              return (
                <button
                  key={k}
                  onClick={() => handleTap(d)}
                  className={`min-h-[64px] rounded-lg flex flex-col items-center pt-1 px-0.5 overflow-hidden active:scale-95 transition-transform ${isToday ? 'ring-2 ring-[#1B4332]' : ''}`}
                  style={{ backgroundColor: color.bg, color: textColor }}
                >
                  <span className="text-[11px] font-semibold leading-none">{d.getDate()}</span>
                  {hasRound && courseName && (
                    <span className="text-[9px] leading-[1.25] text-center mt-2 line-clamp-2 px-0.5" style={{ color: textColor }}>
                      {(() => {
                        const sp = courseName.indexOf(' ');
                        if (sp >= 1 && sp <= 3) {
                          return <>{courseName.slice(0, sp)}<br />{courseName.slice(sp + 1)}</>;
                        }
                        return courseName;
                      })()}
                    </span>
                  )}
                  {hasRound && !courseName && (
                    <Flag size={11} className="mt-1.5" strokeWidth={2.5} style={{ color: level >= 4 ? '#FFFFFF' : '#1B4332' }} />
                  )}
                  {isPlanned && (
                    <span className="mt-2 w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: level >= 4 ? '#FFFFFF' : '#1B4332' }} />
                  )}
                </button>
              );
            })}
          </div>

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
              골프장 이름 = 기록된 라운드, 원(○) = 직접 추가한 예정일. 라운드 있는 날을 탭하면 요약으로 이동하고, 빈 날을 탭하면 예정일 추가, 예정일을 다시 탭하면 삭제됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
