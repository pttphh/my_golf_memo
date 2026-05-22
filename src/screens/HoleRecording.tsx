import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round, Hole } from '../types';
import { emptyHole } from '../types';

function getScoreName(par: number, total: number, overPar: number): string {
  if (isYangpa(par, total)) return '양파';
  if (par === 3 && total === 1) return '홀인원';
  if (overPar <= -3) return '알바트로스';
  if (overPar === -2) return '이글';
  if (overPar === -1) return '버디';
  if (overPar === 0) return '파';
  if (overPar === 1) return '보기';
  if (overPar === 2) return '더블 보기';
  if (overPar === 3) return '트리플';
  if (overPar === 4) return '쿼드러플';
  return `+${overPar}`;
}

function isYangpa(par: number, total: number): boolean {
  return total >= par * 2;
}

function getScoreStyle(par: number, total: number, overPar: number): { text: string; bg: string; border: string } {
  if (isYangpa(par, total)) return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  if (par === 3 && total === 1) return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (overPar <= -1) return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (overPar === 0) return { text: 'text-[#1B4332]', bg: 'bg-green-50', border: 'border-green-200' };
  if (overPar <= 2) return { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300' };
  return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
}

interface Props {
  round: Round;
  initialHoleIndex?: number;
  onFinish: () => void;
  onDeleteRound: () => void;
  onExit?: () => void;
}

const TEE_CLUBS = ['드라이버', '우드', '유틸', '아이언', '웨지'];
const SHOT_CLUBS = ['우드', '유틸', '아이언', '웨지'];
const APPROACH_CLUBS = ['50도 웨지', '58도 웨지'];

const APPROACH_RESULTS = ['그린 온', '그린 미스'];
const PENALTY_TRIGGER = '패널티';

const APPROACH_MISS_SUB = ['오버', '숏', '벙커', 'OB', '해저드'] as const;
type ApproachMissSub = typeof APPROACH_MISS_SUB[number];
const APPROACH_PENALTY_MAP: Record<string, number> = { 'OB': 2, '해저드': 1 };

// par4/5 tee sub-miss options for fairway miss
const TEE_FAIRWAY_MISS_SUB = ['러프', '벙커', 'OB', '해저드'] as const;
type TeeFairwayMissSub = typeof TEE_FAIRWAY_MISS_SUB[number];

const TEE_MISS_PAR45 = ['풀', '훅', '푸쉬', '슬라이스', '뒤땅', '탑볼', '뽕샷', '기타'];
const TEE_MISS_PAR3  = ['풀', '훅', '푸쉬', '슬라이스', '뒤땅', '탑볼', '기타'];
const SECOND_MISS = ['풀', '훅', '푸쉬', '슬라이스', '뒤땅', '탑볼', '생크', '벙커 실패', '기타'];
const APPROACH_MISS = ['오버', '숏', '뒤땅', '탑볼', '생크', '벙커 실패', '기타'];
const PUTT_MISS = ['숏퍼팅 미스', '거리감 미스'];

const FAIRWAY_MISS_PENALTY: Record<string, number> = { 'OB': 2, '해저드': 1 };

const PAR_DEFAULTS: Record<number, { green_shots: number; putts: number }> = {
  3: { green_shots: 2, putts: 2 },
  4: { green_shots: 3, putts: 2 },
  5: { green_shots: 4, putts: 2 },
};

// Returns total penalty strokes for info display only (not reflected in score)
function getPenaltyStrokes(h: Hole): number {
  let pen = 0;
  pen += FAIRWAY_MISS_PENALTY[h.tee_penalty_type] ?? 0;
  // second shots: penalty encoded in second_penalty_type as 'OB' | '해저드'
  for (const p of [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
    pen += FAIRWAY_MISS_PENALTY[p] ?? 0;
  }
  return pen;
}

function clearSecondShot(hole: Hole, i: 2 | 3): Partial<Hole> {
  void hole;
  return {
    [`second${i}_club`]: '',
    [`second${i}_result`]: '',
    [`second${i}_penalty_type`]: '',
    [`second${i}_miss`]: '',
    [`second${i}_miss_detail`]: '',
    [`second${i}_memo`]: '',
  } as Partial<Hole>;
}

function Chip({ label, selected, onClick, variant = 'default' }: {
  label: string; selected: boolean; onClick: () => void; variant?: 'default' | 'miss' | 'penalty';
}) {
  const base = 'px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 cursor-pointer select-none';
  if (variant === 'miss') return (
    <button onClick={onClick} className={`${base} ${selected ? 'bg-red-500 border-red-500 text-white' : 'bg-red-50 border-red-300 text-red-600'}`}>{label}</button>
  );
  if (variant === 'penalty') return (
    <button onClick={onClick} className={`${base} ${selected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-orange-50 border-orange-300 text-orange-600'}`}>{label}</button>
  );
  return (
    <button onClick={onClick} className={`${base} ${selected ? 'bg-[#1B4332] border-[#1B4332] text-white' : 'bg-white border-gray-200 text-gray-700'}`}>{label}</button>
  );
}

function ClubSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332] text-gray-700">
      <option value="">클럽 선택</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Counter({ label, value, onChange, isUnknown }: { label: string; value: number; onChange: (v: number) => void; isUnknown?: boolean }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-600 flex items-center justify-center text-lg font-bold active:scale-90 transition-transform shadow-sm">−</button>
        <span className="w-6 text-center font-bold text-lg">
          {isUnknown ? <span className="text-gray-500">?</span> : <span className="text-gray-800">{value}</span>}
        </span>
        <button onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-lg font-bold active:scale-90 transition-transform shadow-sm">+</button>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-5 rounded-full bg-[#1B4332]" />
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h3>
    </div>
  );
}

function ShotBlock({ result, penaltyType, miss, memo, resultOptions, missOptions, penaltyOptions, onResultChange, onPenaltyChange, onMissChange, onMemoChange }: {
  result: string; penaltyType: string; miss: string; memo: string;
  resultOptions: string[]; missOptions: string[]; penaltyOptions: string[];
  onResultChange: (v: string) => void; onPenaltyChange: (v: string) => void;
  onMissChange: (v: string) => void; onMemoChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1.5">결과</p>
        <div className="flex flex-wrap gap-2">
          {resultOptions.map(r => <Chip key={r} label={r} selected={result === r} onClick={() => onResultChange(result === r ? '' : r)} />)}
        </div>
      </div>
      {result === PENALTY_TRIGGER && (
        <div className="pl-2 flex flex-wrap gap-2">
          {penaltyOptions.map(p => <Chip key={p} label={p} selected={penaltyType === p} onClick={() => onPenaltyChange(penaltyType === p ? '' : p)} variant="penalty" />)}
        </div>
      )}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-1.5">미스 유형 (해당 시)</p>
        <div className="flex flex-wrap gap-2">
          {missOptions.map(m => <Chip key={m} label={m} selected={miss === m} onClick={() => onMissChange(miss === m ? '' : m)} variant="miss" />)}
        </div>
      </div>
      <input type="text" placeholder="메모" value={memo} onChange={e => onMemoChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]" />
    </div>
  );
}

// TeeShotBlock: par-aware tee shot UI
// tee_result stores the top-level choice ('페어웨이' / '페어웨이 미스' / '그린 온 (GIR)' / '그린 미스')
// tee_penalty_type stores the sub-choice when miss is selected ('러프' | '벙커' | 'OB' | '해저드')
// When OB/해저드 is chosen as sub, penalty is derived in getPenaltyStrokes via FAIRWAY_MISS_PENALTY[tee_result]
// So we write the sub-value directly into tee_result when a miss sub is picked, and keep tee_penalty_type for the label
function TeeShotBlock({ par, topResult, subResult, miss, memo, onTopChange, onSubChange, onMissChange, onMemoChange }: {
  par: number;
  topResult: string;   // tee_result top level
  subResult: string;   // tee_penalty_type repurposed as sub-pick storage
  miss: string;
  memo: string;
  onTopChange: (v: string) => void;
  onSubChange: (v: string) => void;
  onMissChange: (v: string) => void;
  onMemoChange: (v: string) => void;
}) {
  const isPar3 = par === 3;
  const topOptions = isPar3
    ? ['그린 온', '그린 미스']
    : ['페어웨이', '페어웨이 미스'];
  const missLabel = isPar3 ? '그린 미스' : '페어웨이 미스';
  const showSub = topResult === missLabel;
  const missOptions = isPar3 ? TEE_MISS_PAR3 : TEE_MISS_PAR45;

  function handleTopClick(v: string) {
    if (topResult === v) {
      onTopChange('');
      onSubChange('');
    } else {
      onTopChange(v);
      if (v !== missLabel) onSubChange('');
    }
  }

  function handleSubClick(v: TeeFairwayMissSub) {
    onSubChange(subResult === v ? '' : v);
  }

  const penaltyStrokesForSub = subResult ? (FAIRWAY_MISS_PENALTY[subResult] ?? 0) : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1.5">결과</p>
        <div className="flex flex-wrap gap-2">
          {topOptions.map(opt => (
            <Chip key={opt} label={opt} selected={topResult === opt} onClick={() => handleTopClick(opt)} />
          ))}
        </div>
      </div>

      {showSub && (
        <div className="pl-3 border-l-2 border-gray-200 space-y-2">
          <p className="text-xs text-gray-500">세부 위치</p>
          <div className="flex flex-wrap gap-2">
            {TEE_FAIRWAY_MISS_SUB.map(s => {
              const pen = FAIRWAY_MISS_PENALTY[s];
              const isOBHaz = pen !== undefined;
              return (
                <button
                  key={s}
                  onClick={() => handleSubClick(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 cursor-pointer select-none ${
                    subResult === s
                      ? isOBHaz ? 'bg-orange-500 border-orange-500 text-white' : 'bg-[#1B4332] border-[#1B4332] text-white'
                      : isOBHaz ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-1.5">미스 유형 (해당 시)</p>
        <MissChips value={miss} options={missOptions} onChange={onMissChange} />
      </div>
      <input type="text" placeholder="메모" value={memo} onChange={e => onMemoChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]" />
    </div>
  );
}

// Score = green shots + putts only. Penalties are info-only.
function buildAutoTotal(h: Hole): number {
  return h.green_shots + h.putts;
}

function parseMiss(raw: string): string[] {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function toggleMiss(raw: string, item: string): string {
  const list = parseMiss(raw);
  if (list.includes(item)) return list.filter(m => m !== item).join(', ');
  if (list.length >= 2) return raw; // max 2
  return [...list, item].join(', ');
}

function MissChips({ value, options, onChange, hint = true }: {
  value: string; options: string[]; onChange: (v: string) => void; hint?: boolean;
}) {
  const selected = parseMiss(value);
  const maxReached = selected.length >= 2;
  return (
    <div className="space-y-1.5">
      {hint && <p className="text-[11px] text-gray-500">ex) 풀훅일 경우 풀과 훅 모두 선택</p>}
      <div className="flex flex-wrap gap-2">
      {options.map(m => {
        const isSelected = selected.includes(m);
        const isDisabled = maxReached && !isSelected;
        const base = 'px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 select-none';
        const cls = isSelected
          ? `${base} bg-red-500 border-red-500 text-white cursor-pointer`
          : isDisabled
            ? `${base} bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed`
            : `${base} bg-red-50 border-red-300 text-red-600 cursor-pointer`;
        return (
          <button key={m} disabled={isDisabled} onClick={() => onChange(toggleMiss(value, m))} className={cls}>
            {m}
          </button>
        );
      })}
      </div>
    </div>
  );
}

const SECOND_GREEN_MISS_SUB = ['우측 미스', '좌측 미스', '오버', '숏', '벙커'] as const;
const SECOND_PENALTY_SUB = ['OB', '해저드'] as const;
type SecondMissDetail = typeof SECOND_GREEN_MISS_SUB[number] | typeof SECOND_PENALTY_SUB[number];

function parseDetail(raw: string): SecondMissDetail[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean) as SecondMissDetail[];
}

function serializeDetail(items: SecondMissDetail[]): string {
  return items.join(',');
}

// SecondShotBlock: 2-step result UI for second/additional shots
function SecondShotBlock({ result, penaltyType, missDetail, miss, memo, isExtra,
  onResultChange, onPenaltyChange, onMissDetailChange, onMissChange, onMemoChange }: {
  result: string;
  penaltyType: string;
  missDetail: string;
  miss: string;
  memo: string;
  isExtra?: boolean; // true for 2nd/3rd second shots: use '그린 온' instead of '그린 온 (GIR)'
  onResultChange: (v: string) => void;
  onPenaltyChange: (v: string) => void;
  onMissDetailChange: (v: string) => void;
  onMissChange: (v: string) => void;
  onMemoChange: (v: string) => void;
}) {
  const greenOnLabel = isExtra ? '그린 온' : '그린 온';
  const showSub = result === '그린 미스';
  const details = parseDetail(missDetail);

  function toggleDetail(item: SecondMissDetail) {
    let next: SecondMissDetail[];
    if (SECOND_PENALTY_SUB.includes(item as typeof SECOND_PENALTY_SUB[number])) {
      // OB/해저드: mutually exclusive, also stored in penaltyType
      if (penaltyType === item) {
        onPenaltyChange('');
        next = details.filter(d => !SECOND_PENALTY_SUB.includes(d as typeof SECOND_PENALTY_SUB[number]));
      } else {
        onPenaltyChange(item);
        next = [...details.filter(d => !SECOND_PENALTY_SUB.includes(d as typeof SECOND_PENALTY_SUB[number])), item];
      }
    } else {
      next = details.includes(item) ? details.filter(d => d !== item) : [...details, item];
    }
    onMissDetailChange(serializeDetail(next));
  }

  function handleTopClick(v: string) {
    onResultChange(result === v ? '' : v);
    if (v !== '그린 미스') {
      onMissDetailChange('');
      onPenaltyChange('');
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1.5">결과</p>
        <div className="flex flex-wrap gap-2">
          {[greenOnLabel, '그린 미스'].map(opt => (
            <Chip key={opt} label={opt} selected={result === opt} onClick={() => handleTopClick(opt)} />
          ))}
        </div>
      </div>

      {showSub && (
        <div className="pl-3 border-l-2 border-gray-200 space-y-2">
          <p className="text-xs text-gray-500">세부 위치 (복수 선택 가능)</p>
          <div className="flex flex-wrap gap-2">
            {SECOND_GREEN_MISS_SUB.map(s => (
              <Chip key={s} label={s} selected={details.includes(s)} onClick={() => toggleDetail(s)} />
            ))}
            {SECOND_PENALTY_SUB.map(s => (
              <button key={s} onClick={() => toggleDetail(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 cursor-pointer select-none ${
                  penaltyType === s
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'bg-orange-50 border-orange-300 text-orange-600'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-1.5">미스 유형 (해당 시)</p>
        <MissChips value={miss} options={SECOND_MISS} onChange={onMissChange} />
      </div>
      <input type="text" placeholder="메모" value={memo} onChange={e => onMemoChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]" />
    </div>
  );
}

function parseApproachDetail(raw: string): ApproachMissSub[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean) as ApproachMissSub[];
}

function serializeApproachDetail(items: ApproachMissSub[]): string {
  return items.join(',');
}

function ApproachBlock({ result, missDetail, miss, memo,
  onResultChange, onMissDetailChange, onMissChange, onMemoChange }: {
  result: string;
  missDetail: string;
  miss: string;
  memo: string;
  onResultChange: (v: string) => void;
  onMissDetailChange: (v: string) => void;
  onMissChange: (v: string) => void;
  onMemoChange: (v: string) => void;
}) {
  const showSub = result === '그린 미스';
  const details = parseApproachDetail(missDetail);
  const penaltyTotal = details.reduce((s, d) => s + (APPROACH_PENALTY_MAP[d] ?? 0), 0);

  function toggleDetail(item: ApproachMissSub) {
    const isPenalty = APPROACH_PENALTY_MAP[item] !== undefined;
    let next: ApproachMissSub[];
    if (isPenalty) {
      // OB/해저드: mutually exclusive
      if (details.includes(item)) {
        next = details.filter(d => d !== item);
      } else {
        next = [...details.filter(d => APPROACH_PENALTY_MAP[d] === undefined), item];
      }
    } else {
      next = details.includes(item) ? details.filter(d => d !== item) : [...details, item];
    }
    onMissDetailChange(serializeApproachDetail(next));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1.5">결과</p>
        <div className="flex flex-wrap gap-2">
          {APPROACH_RESULTS.map(r => (
            <Chip key={r} label={r} selected={result === r}
              onClick={() => { onResultChange(result === r ? '' : r); if (r !== '그린 미스') onMissDetailChange(''); }} />
          ))}
        </div>
      </div>

      {showSub && (
        <div className="pl-3 border-l-2 border-gray-200 space-y-2">
          <p className="text-xs text-gray-500">세부 위치 (복수 선택 가능)</p>
          <div className="flex flex-wrap gap-2">
            {APPROACH_MISS_SUB.map(s => {
              const isPenalty = APPROACH_PENALTY_MAP[s] !== undefined;
              return (
                <button key={s} onClick={() => toggleDetail(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 cursor-pointer select-none ${
                    details.includes(s)
                      ? isPenalty ? 'bg-orange-500 border-orange-500 text-white' : 'bg-[#1B4332] border-[#1B4332] text-white'
                      : isPenalty ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-white border-gray-200 text-gray-700'
                  }`}>
                  {s}
                </button>
              );
            })}
          </div>
          {penaltyTotal > 0 && (
            <p className="text-xs text-orange-500 font-medium">벌타 +{penaltyTotal}타 (스코어 미반영)</p>
          )}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-1.5">미스 유형 (해당 시)</p>
        <MissChips value={miss} options={APPROACH_MISS} onChange={onMissChange} />
        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">오버/숏: 20m 이내 어프로치에서 핀을 5m 이상 지나치거나 못 미친 경우</p>
      </div>
      <input type="text" placeholder="메모" value={memo} onChange={e => onMemoChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]" />
    </div>
  );
}

function makeDefaultHole(roundId: string, holeNumber: number): Hole {
  const defaults = PAR_DEFAULTS[4];
  return { ...emptyHole(roundId, holeNumber), ...defaults, total_strokes: defaults.green_shots + defaults.putts, over_par: 1 };
}

export default function HoleRecording({ round, initialHoleIndex = 0, onFinish, onDeleteRound, onExit }: Props) {
  const [currentHoleIndex, setCurrentHoleIndex] = useState(initialHoleIndex);
  const holeNumber = currentHoleIndex + 1;

  const [hole, setHole] = useState<Hole>(() => makeDefaultHole(round.id, 1));
  const [isManual, setIsManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [secondShotsCount, setSecondShotsCount] = useState(1);
  const [approachCount, setApproachCount] = useState(1);

  // savedHoles: keyed by hole_number for header stats
  const [savedHoles, setSavedHoles] = useState<Record<number, Hole>>({});

  const loadHole = useCallback(async (holeNum: number) => {
    const { data } = await supabase
      .from('holes')
      .select('*')
      .eq('round_id', round.id)
      .eq('hole_number', holeNum)
      .maybeSingle();
    if (data) {
      const h = data as Hole;
      setHole(h);
      setIsManual(false);
      setSavedHoles(prev => ({ ...prev, [h.hole_number]: h }));
      let sc = 1;
      if (h.second3_club || h.second3_result || h.second3_miss) sc = 3;
      else if (h.second2_club || h.second2_result || h.second2_miss) sc = 2;
      setSecondShotsCount(sc);
      setApproachCount((h.approach2_club || h.approach2_miss) ? 2 : 1);
    } else {
      setHole(makeDefaultHole(round.id, holeNum));
      setIsManual(false);
      setSecondShotsCount(1);
      setApproachCount(1);
    }
  }, [round.id]);

  useEffect(() => {
    loadHole(holeNumber);
  }, [holeNumber, loadHole]);

  function updateAuto(updates: Partial<Hole>) {
    setIsManual(false);
    setHole(prev => {
      const next = { ...prev, ...updates };
      const total = buildAutoTotal(next);
      return { ...next, total_strokes: total, over_par: total - next.par };
    });
  }

  function updateField(updates: Partial<Hole>) {
    setHole(prev => {
      const next = { ...prev, ...updates };
      if (!isManual) {
        const total = buildAutoTotal(next);
        return { ...next, total_strokes: total, over_par: total - next.par };
      }
      return { ...next, over_par: next.total_strokes - next.par };
    });
  }

  function adjustManualScore(delta: number) {
    setIsManual(true);
    setHole(prev => {
      const total = Math.max(1, prev.total_strokes + delta);
      return { ...prev, total_strokes: total, over_par: total - prev.par };
    });
  }

  function handleParChange(p: number) {
    const defaults = PAR_DEFAULTS[p];
    setIsManual(false);
    setHole(prev => {
      const next = { ...prev, par: p, green_shots: defaults.green_shots, putts: defaults.putts };
      const total = buildAutoTotal(next);
      return { ...next, total_strokes: total, over_par: total - p };
    });
  }

  function removeSecondShot(i: 2 | 3) {
    updateField(clearSecondShot(hole, i));
    setSecondShotsCount(i - 1);
  }

 async function upsertHole(h: Hole): Promise<void> {
  const { id, ...fields } = { ...h, is_manual: isManual };
  console.log('[upsert round_id]', fields.round_id);
  const { error } = await supabase
    .from('holes')
    .upsert(fields, { onConflict: 'round_id,hole_number', ignoreDuplicates: false });
  if (error) console.error('[upsert 오류]', error.message);
}

  async function handleSave(goNext: boolean) {
    setSaving(true);
    await upsertHole(hole);
    setSavedHoles(prev => ({ ...prev, [holeNumber]: hole }));
    setSaving(false);
    if (goNext && holeNumber === 18) {
      onFinish();
      return;
    }
    setCurrentHoleIndex(goNext ? currentHoleIndex + 1 : currentHoleIndex - 1);
  }

  // Header stats: savedHoles holds previously saved holes (excluding current)
  // current hole is always included live in calculations
  const overPar = hole.over_par;

  // All holes to consider for total: saved previous holes + current hole
  const savedList = Object.values(savedHoles).filter(h => h.hole_number !== holeNumber);
  const allLive = [...savedList, hole];

  const totalScore = allLive.reduce((s, h) => s + h.total_strokes, 0);
  const totalPar = allLive.reduce((s, h) => s + h.par, 0);
  const totalOver = totalScore - totalPar;

  const isBackNine = holeNumber >= 10;

  // Front9: if currently in front9, show live (saved front9 + current); if in back9, show fixed final
  const front9Saved = savedList.filter(h => h.hole_number <= 9);
  const front9Score = isBackNine
    ? front9Saved.reduce((s, h) => s + h.total_strokes, 0)
    : [...front9Saved, hole].reduce((s, h) => s + h.total_strokes, 0);
  const front9Par = isBackNine
    ? front9Saved.reduce((s, h) => s + h.par, 0)
    : [...front9Saved, hole].reduce((s, h) => s + h.par, 0);
  const front9Over = front9Score - front9Par;
  const front9Done = isBackNine;

  // Back9: live only when in back9
  const back9Saved = savedList.filter(h => h.hole_number >= 10);
  const back9Score = isBackNine
    ? [...back9Saved, hole].reduce((s, h) => s + h.total_strokes, 0)
    : back9Saved.reduce((s, h) => s + h.total_strokes, 0);
  const back9Par = isBackNine
    ? [...back9Saved, hole].reduce((s, h) => s + h.par, 0)
    : back9Saved.reduce((s, h) => s + h.par, 0);
  const back9Over = back9Score - back9Par;
  const back9Started = isBackNine;

  const progressFraction = currentHoleIndex / 18;

  const scoreName = getScoreName(hole.par, hole.total_strokes, overPar);
  const isMaxScore = isYangpa(hole.par, hole.total_strokes);
  const scoreStyle = getScoreStyle(hole.par, hole.total_strokes, overPar);

  const secondKeys = ([1, 2, 3] as const).slice(0, secondShotsCount);

  return (
    <div className="min-h-screen bg-[#f9f9f7] flex flex-col">
      {/* Header - Slim version */}
      <div className="bg-[#1B4332] text-white px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        {/* Top row: X button | hole number | cumulative score */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {onExit && (
              <button 
                onClick={onExit}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
              >
                <X size={18} className="text-white/80" />
              </button>
            )}
            <div>
              <p className="text-green-300 text-[10px]">{round.course_name}</p>
              <h2 className="text-lg font-bold leading-tight">{holeNumber}번 홀</h2>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-extrabold leading-none ${totalOver > 0 ? 'text-yellow-300' : totalOver < 0 ? 'text-blue-200' : 'text-white'}`}>
              {totalOver === 0 ? 'E' : totalOver > 0 ? `+${totalOver}` : totalOver}
            </p>
            <p className="text-green-300 text-xs font-medium">{totalScore}타</p>
          </div>
        </div>

        {/* Progress bar - Compact */}
        <div>
          <div className="relative h-1.5 bg-green-800/50 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progressFraction * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className={`text-[10px] font-medium transition-opacity ${front9Done ? 'opacity-50' : 'opacity-100'} text-white`}>
              전반 {front9Over === 0 ? 'E' : front9Over > 0 ? `+${front9Over}` : front9Over}
              <span className="text-green-300 ml-0.5">({front9Score})</span>
            </span>
            <span className={`text-[10px] font-medium transition-opacity ${back9Started ? 'opacity-100' : 'opacity-50'} text-white`}>
              후반 {back9Started
                ? <>{back9Over === 0 ? 'E' : back9Over > 0 ? `+${back9Over}` : back9Over}<span className="text-green-300 ml-0.5">({back9Score})</span></>
                : <span className="text-green-300">-</span>
              }
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 pb-28">
        {/* Combined: Par + On-Green + Putting + Score */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Par Selection */}
          <div className="p-4 pb-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">파 선택</div>
            <div className="flex gap-2">
              {[3, 4, 5].map(p => (
                <button key={p} onClick={() => handleParChange(p)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all active:scale-95 ${hole.par === p ? 'bg-[#1B4332] border-[#1B4332] text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  파{p}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-100 mx-4" />

          {/* Counters side by side */}
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {/* Green shots */}
            <div className="flex flex-col items-center py-4 gap-2">
              <p className="text-xs text-gray-500 font-medium">온그린까지</p>
              <div className="flex items-center gap-2.5">
                <button onClick={() => updateAuto({ green_shots: Math.max(0, hole.green_shots - 1) })}
                  className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 text-gray-600 flex items-center justify-center text-lg font-bold active:scale-90 transition-transform">−</button>
                <span className="w-6 text-center font-bold text-xl text-gray-800">
                  {isManual ? <span className="text-gray-400 text-lg">?</span> : hole.green_shots}
                </span>
                <button onClick={() => updateAuto({ green_shots: hole.green_shots + 1 })}
                  className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-lg font-bold active:scale-90 transition-transform">+</button>
              </div>
              <p className="text-[10px] text-gray-400">타수</p>
            </div>
            {/* Putts */}
            <div className="flex flex-col items-center py-4 gap-2">
              <p className="text-xs text-gray-500 font-medium">퍼팅</p>
              <div className="flex items-center gap-2.5">
                <button onClick={() => updateAuto({ putts: Math.max(0, hole.putts - 1) })}
                  className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 text-gray-600 flex items-center justify-center text-lg font-bold active:scale-90 transition-transform">−</button>
                <span className="w-6 text-center font-bold text-xl text-gray-800">
                  {isManual ? <span className="text-gray-400 text-lg">?</span> : hole.putts}
                </span>
                <button onClick={() => updateAuto({ putts: hole.putts + 1 })}
                  className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-lg font-bold active:scale-90 transition-transform">+</button>
              </div>
              <p className="text-[10px] text-gray-400">수</p>
            </div>
          </div>

          {/* Score Result */}
          <div className={`border-t-2 ${scoreStyle.border} ${scoreStyle.bg} px-4 py-3`}>
            <div className="flex items-center justify-between">
              <button
                onClick={() => adjustManualScore(-1)}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center text-xl font-bold active:scale-90 transition-transform shadow-sm"
              >−</button>
              <div className="text-center">
                <p className={`text-2xl font-extrabold tracking-tight ${scoreStyle.text}`}>{scoreName}</p>
                <p className={`text-xs mt-0.5 font-medium ${scoreStyle.text} opacity-70`}>
                  {overPar === 0
                    ? `총 ${hole.total_strokes}타`
                    : `${overPar > 0 ? `+${overPar}` : overPar} · 총 ${hole.total_strokes}타`}
                </p>
              </div>
              <button
                onClick={() => adjustManualScore(1)}
                disabled={isMaxScore}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center text-xl font-bold active:scale-90 transition-transform shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >+</button>
            </div>
          </div>

          {/* Penalty info */}
          {getPenaltyStrokes(hole) > 0 && (
            <div className="mx-4 mb-3 mt-2 flex justify-between items-center bg-orange-50 rounded-xl px-3 py-2 border border-orange-100">
              <span className="text-xs text-orange-600 font-medium">벌타 +{getPenaltyStrokes(hole)}타 포함</span>
            </div>
          )}

          {/* Hint */}
          <div className={`mx-4 mb-3 ${getPenaltyStrokes(hole) === 0 ? 'mt-2' : ''} flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${isManual ? 'bg-orange-50' : 'bg-gray-50'}`}>
            {isManual && <Lock size={11} className="text-orange-400 flex-shrink-0" />}
            <p className={`text-[10px] leading-relaxed ${isManual ? 'text-orange-500' : 'text-gray-400'}`}>
              {isManual
                ? '수동 집계 중. 카운터를 누르면 자동 집계로 전환'
                : '카운터 입력 시 자동 집계 · +−로 직접 수정 가능'}
            </p>
          </div>
        </div>

        {/* Tee Shot */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title="티샷" />
          <div className="space-y-3">
            <ClubSelect value={hole.tee_club} onChange={v => updateField({ tee_club: v })} options={TEE_CLUBS} />
            <TeeShotBlock
              par={hole.par}
              topResult={hole.tee_result}
              subResult={hole.tee_penalty_type}
              miss={hole.tee_miss}
              memo={hole.tee_memo}
              onTopChange={v => updateField({ tee_result: v })}
              onSubChange={v => updateField({ tee_penalty_type: v })}
              onMissChange={v => updateField({ tee_miss: v })}
              onMemoChange={v => updateField({ tee_memo: v })}
            />
          </div>
        </div>

        {/* Second Shots */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title="세컨샷" />
          <div className="space-y-4">
            {secondKeys.map(i => (
              <div key={i} className={`${i > 1 ? 'pt-3 border-t border-gray-100' : ''}`}>
                {secondShotsCount > 1 && (
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500">{i}번째 샷</p>
                    {i > 1 && (
                      <button onClick={() => removeSecondShot(i as 2 | 3)}
                        className="w-6 h-6 rounded-full bg-red-50 border border-red-200 text-red-500 flex items-center justify-center active:scale-90 transition-transform">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-3">
                  <ClubSelect
                    value={hole[`second${i}_club` as keyof Hole] as string}
                    onChange={v => updateField({ [`second${i}_club`]: v })}
                    options={SHOT_CLUBS}
                  />
                  <SecondShotBlock
                    result={hole[`second${i}_result` as keyof Hole] as string}
                    penaltyType={hole[`second${i}_penalty_type` as keyof Hole] as string}
                    missDetail={hole[`second${i}_miss_detail` as keyof Hole] as string}
                    miss={hole[`second${i}_miss` as keyof Hole] as string}
                    memo={hole[`second${i}_memo` as keyof Hole] as string}
                    isExtra={i > 1}
                    onResultChange={v => updateField({ [`second${i}_result`]: v })}
                    onPenaltyChange={v => updateField({ [`second${i}_penalty_type`]: v })}
                    onMissDetailChange={v => updateField({ [`second${i}_miss_detail`]: v })}
                    onMissChange={v => updateField({ [`second${i}_miss`]: v })}
                    onMemoChange={v => updateField({ [`second${i}_memo`]: v })}
                  />
                </div>
              </div>
            ))}
            {secondShotsCount < 3 && (
              <button onClick={() => setSecondShotsCount(c => c + 1)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm active:bg-gray-50 transition-colors">
                <Plus size={15} /> 샷 추가
              </button>
            )}
          </div>
        </div>

        {/* Approach */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title="어프로치" />
          <div className="space-y-4">
            {([1, 2] as const).slice(0, approachCount).map(i => (
              <div key={i} className={`${i > 1 ? 'pt-3 border-t border-gray-100' : ''}`}>
                {approachCount > 1 && <p className="text-xs font-semibold text-gray-500 mb-2">{i}번째 어프로치</p>}
                <div className="space-y-3">
                  <ClubSelect
                    value={hole[`approach${i}_club` as keyof Hole] as string}
                    onChange={v => updateField({ [`approach${i}_club`]: v })}
                    options={APPROACH_CLUBS}
                  />
                  <ApproachBlock
                    result={hole[`approach${i}_result` as keyof Hole] as string}
                    missDetail={hole[`approach${i}_miss_detail` as keyof Hole] as string}
                    miss={hole[`approach${i}_miss` as keyof Hole] as string}
                    memo={hole[`approach${i}_memo` as keyof Hole] as string}
                    onResultChange={v => updateField({ [`approach${i}_result`]: v })}
                    onMissDetailChange={v => updateField({ [`approach${i}_miss_detail`]: v })}
                    onMissChange={v => updateField({ [`approach${i}_miss`]: v })}
                    onMemoChange={v => updateField({ [`approach${i}_memo`]: v })}
                  />
                </div>
              </div>
            ))}
            {approachCount < 2 && (
              <button onClick={() => setApproachCount(c => c + 1)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm active:bg-gray-50 transition-colors">
                <Plus size={15} /> 어프로치 추가
              </button>
            )}
          </div>
        </div>

        {/* Putting Miss Types */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title="퍼팅 미스" />
          <div className="space-y-3">
            <MissChips value={hole.putt_miss} options={PUTT_MISS} onChange={v => updateField({ putt_miss: v })} hint={false} />
            <p className="text-[10px] text-gray-400">숏퍼팅 미스: 2m 이내 실패 · 거리감 미스: 3m 이상 남김</p>
            <input type="text" placeholder="메모" value={hole.putt_memo}
              onChange={e => updateField({ putt_memo: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
            />
          </div>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-100 px-4 pt-3 pb-6 shadow-lg">
        <div className="flex gap-3">
          {holeNumber > 1 && (
            <button onClick={() => handleSave(false)} disabled={saving}
              className="flex-shrink-0 flex items-center justify-center gap-1 px-4 py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60">
              <ChevronLeft size={16} /> 이전 홀
            </button>
          )}
          <button onClick={() => handleSave(true)} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#1B4332] text-white py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-lg shadow-green-900/20 disabled:opacity-60">
            {saving ? '저장 중...' : holeNumber === 18 ? '라운드 완료' : '저장 · 다음 홀'}
            {!saving && holeNumber < 18 && <ChevronRight size={16} />}
          </button>
        </div>
      </div>

    </div>
  );
}
