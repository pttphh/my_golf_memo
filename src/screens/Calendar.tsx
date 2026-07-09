import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round } from '../types';

const PLANNED_KEY = 'golf_planned_dates';
const MEMO_KEY = 'golf_memos';

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

type PlanState = 'temp' | 'confirmed';

function loadPlanned(): Record<string, PlanState> {
  try {
    const raw = localStorage.getItem(PLANNED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const obj: Record<string, PlanState> = {};
      for (const k of parsed as string[]) obj[k] = 'temp';
      return obj;
    }
    return parsed as Record<string, PlanState>;
  } catch {
    return {};
  }
}

function loadMemos(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MEMO_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

interface Props {
  onRoundSelect: (round: Round) => void;
}

export default function Calendar({ onRoundSelect }: Props) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [planned, setPlanned] = useState<Record<string, PlanState>>(() => loadPlanned());
  const [memos, setMemos] = useState<Record<string, string>>(() => loadMemos());
  const [memoEdit, setMemoEdit] = useState<{ key: string; value: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

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

  useEffect(() => {
    try { localStorage.setItem(MEMO_KEY, JSON.stringify(memos)); } catch { /* noop */ }
  }, [memos]);

  // 날짜별 기록된 라운드
  const byDate = new Map<string, Round[]>();
  for (const r of rounds) {
    if (!r.date) continue;
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }
  // 활성 날짜 = 기록 라운드 OR 예정(임시·확정). 창 안 '고유 날짜' 수(같은 날 둘 다 있어도 1로 카운트).
  function windowCount(d: Date): number {
    let c = 0;
    for (let off = -7; off <= 7; off++) {
      const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off);
      const k = toKey(dd);
      if (byDate.has(k) || planned[k]) c++;
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

  function startPress(d: Date, e: React.TouchEvent | React.MouseEvent) {
    longPressFired.current = false;
    const pt = 'touches' in e ? e.touches[0] : e;
    pressStart.current = { x: pt.clientX, y: pt.clientY };
    if (longPressTimer.current !== null) clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      const k = toKey(d);
      setMemoEdit({ key: k, value: memos[k] ?? '' });
    }, 500);
  }
  function movePress(e: React.TouchEvent | React.MouseEvent) {
    if (!pressStart.current || longPressTimer.current === null) return;
    const pt = 'touches' in e ? e.touches[0] : e;
    if (Math.abs(pt.clientX - pressStart.current.x) > 12 ||
        Math.abs(pt.clientY - pressStart.current.y) > 12) {
      cancelPress();
    }
  }
  function cancelPress() {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }
  function saveMemo() {
    if (!memoEdit) return;
    const v = memoEdit.value.trim();
    setMemos(prev => {
      const next = { ...prev };
      if (v) next[memoEdit.key] = v; else delete next[memoEdit.key];
      return next;
    });
    setMemoEdit(null);
  }
  function deleteMemo() {
    if (!memoEdit) return;
    setMemos(prev => {
      const next = { ...prev };
      delete next[memoEdit.key];
      return next;
    });
    setMemoEdit(null);
  }

  function handleTap(d: Date) {
    if (longPressFired.current) { longPressFired.current = false; return; }
    const k = toKey(d);
    const list = byDate.get(k);
    if (list && list.length > 0) {
      onRoundSelect(list[0]); // 기록된 라운드 → 그 날 라운드 요약으로 이동
      return;
    }
    // 예정 3단계 순환: 없음 → 임시(○) → 확정(깃발) → 삭제
    setPlanned(prev => {
      const next = { ...prev };
      const cur = next[k];
      if (!cur) next[k] = 'temp';
      else if (cur === 'temp') next[k] = 'confirmed';
      else delete next[k];
      return next;
    });
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
              const planState = !hasRound ? planned[k] : undefined;
              const isToday = k === todayKey;
              const textColor = level === 0 ? '#6B7280' : color.text;
              const courseName = hasRound ? (dayRounds[0].course_name || '') : '';
              const memo = memos[k];
              return (
                <button
                  key={k}
                  onClick={() => handleTap(d)}
                  onTouchStart={e => startPress(d, e)}
                  onTouchEnd={cancelPress}
                  onTouchMove={movePress}
                  onMouseDown={e => startPress(d, e)}
                  onMouseUp={cancelPress}
                  onMouseLeave={cancelPress}
                  onContextMenu={e => e.preventDefault()}
                  className={`min-h-[64px] rounded-lg flex flex-col items-center pt-1 px-0.5 overflow-hidden active:scale-95 transition-transform select-none ${isToday ? 'ring-2 ring-[#1B4332]' : ''}`}
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
                  {planState === 'temp' && (
                    <span className="mt-2 w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: level >= 4 ? '#FFFFFF' : '#1B4332' }} />
                  )}
                  {planState === 'confirmed' && (
                    <Flag size={13} className="mt-2" strokeWidth={2.5} style={{ color: level >= 4 ? '#FFFFFF' : '#1B4332' }} />
                  )}
                  {memo && (
                    <span className="text-[8px] leading-[1.2] text-center mt-auto pt-1 w-full line-clamp-1 px-0.5 opacity-90" style={{ color: textColor }}>
                      {memo}
                    </span>
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
              골프장 이름 = 기록된 라운드. 빈 날을 탭하면 임시(○) → 확정(깃발) → 삭제 순으로 바뀝니다. 라운드 있는 날을 탭하면 요약으로 이동합니다. 날짜를 길게 누르면(꾹) 메모를 남길 수 있어요.
            </p>
          </div>
        </div>
      )}

      {memoEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMemoEdit(null)} />
          <div className="relative bg-white rounded-t-2xl w-full max-w-[390px] p-5 pb-10">
            <h3 className="text-base font-bold text-gray-800 mb-1">📝 메모</h3>
            <p className="text-xs text-gray-400 mb-3">{memoEdit.key}</p>
            <textarea
              autoFocus
              value={memoEdit.value}
              onChange={e => setMemoEdit(prev => (prev ? { ...prev, value: e.target.value } : prev))}
              placeholder="이 날짜에 대한 메모를 입력하세요"
              maxLength={60}
              className="w-full h-24 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={deleteMemo} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm active:scale-95 transition-transform">삭제</button>
              <button onClick={saveMemo} className="flex-[2] py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-transform">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
