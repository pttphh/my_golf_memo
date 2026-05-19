import { useState, useEffect } from 'react';
import { ChevronLeft, Lock, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round, Hole } from '../types';
import { emptyHole } from '../types';

// ── shared helpers ────────────────────────────────────────────────────────────

function getScoreName(par: number, total: number, overPar: number): string {
  if (total >= par * 2) return '양파';
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

function getScoreStyle(par: number, total: number, overPar: number) {
  if (total >= par * 2) return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  if (par === 3 && total === 1) return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (overPar <= -1) return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (overPar === 0) return { text: 'text-[#1a6b3a]', bg: 'bg-green-50', border: 'border-green-200' };
  if (overPar <= 2) return { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300' };
  return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
}

const TEE_CLUBS = ['드라이버', '우드', '유틸', '아이언', '웨지'];
const SHOT_CLUBS = ['우드', '유틸', '아이언', '웨지'];
const APPROACH_CLUBS = ['50도 웨지', '58도 웨지'];
const APPROACH_RESULTS = ['그린 온', '그린 미스'];
const PENALTY_TRIGGER = '패널티';
const TEE_FAIRWAY_MISS_SUB = ['러프', '벙커', 'OB', '해저드'] as const;
type TeeFairwayMissSub = typeof TEE_FAIRWAY_MISS_SUB[number];
const TEE_MISS_PAR45 = ['풀', '훅', '푸쉬', '슬라이스', '뒤땅', '탑볼', '뽕샷', '기타'];
const TEE_MISS_PAR3 = ['풀', '훅', '푸쉬', '슬라이스', '뒤땅', '탑볼', '기타'];
const SECOND_MISS = ['풀', '훅', '푸쉬', '슬라이스', '뒤땅', '탑볼', '생크', '벙커 실패', '기타'];
const APPROACH_MISS = ['오버', '숏', '뒤땅', '탑볼', '생크', '벙커 실패', '기타'];
const PUTT_MISS = ['숏퍼팅 미스', '거리감 미스'];
const FAIRWAY_MISS_PENALTY: Record<string, number> = { OB: 2, '해저드': 1 };
const APPROACH_MISS_SUB = ['오버', '숏', '벙커', 'OB', '해저드'] as const;
type ApproachMissSub = typeof APPROACH_MISS_SUB[number];
const APPROACH_PENALTY_MAP: Record<string, number> = { OB: 2, '해저드': 1 };
const PAR_DEFAULTS: Record<number, { green_shots: number; putts: number }> = {
  3: { green_shots: 2, putts: 2 },
  4: { green_shots: 3, putts: 2 },
  5: { green_shots: 4, putts: 2 },
};
const SECOND_GREEN_MISS_SUB = ['우측 미스', '좌측 미스', '오버', '숏', '벙커'] as const;
const SECOND_PENALTY_SUB = ['OB', '해저드'] as const;
type SecondMissDetail = typeof SECOND_GREEN_MISS_SUB[number] | typeof SECOND_PENALTY_SUB[number];

function buildAutoTotal(h: Hole): number { return h.green_shots + h.putts; }
function parseMiss(raw: string): string[] { return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : []; }
function toggleMiss(raw: string, item: string): string {
  const list = parseMiss(raw);
  if (list.includes(item)) return list.filter(m => m !== item).join(', ');
  if (list.length >= 2) return raw;
  return [...list, item].join(', ');
}
function parseDetail<T extends string>(raw: string): T[] { return raw ? raw.split(',').filter(Boolean) as T[] : []; }
function serializeDetail<T extends string>(items: T[]): string { return items.join(','); }

// ── small UI components ───────────────────────────────────────────────────────

function Chip({ label, selected, onClick, variant = 'default' }: {
  label: string; selected: boolean; onClick: () => void; variant?: 'default' | 'miss' | 'penalty';
}) {
  const base = 'px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 cursor-pointer select-none';
  if (variant === 'miss') return <button onClick={onClick} className={`${base} ${selected ? 'bg-red-500 border-red-500 text-white' : 'bg-red-50 border-red-300 text-red-600'}`}>{label}</button>;
  if (variant === 'penalty') return <button onClick={onClick} className={`${base} ${selected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-orange-50 border-orange-300 text-orange-600'}`}>{label}</button>;
  return <button onClick={onClick} className={`${base} ${selected ? 'bg-[#1a6b3a] border-[#1a6b3a] text-white' : 'bg-white border-gray-200 text-gray-700'}`}>{label}</button>;
}

function ClubSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a6b3a]/30 focus:border-[#1a6b3a] text-gray-700">
      <option value="">클럽 선택</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-5 rounded-full bg-[#1a6b3a]" />
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h3>
    </div>
  );
}

function MissChips({ value, options, onChange, hint = true }: {
  value: string; options: string[]; onChange: (v: string) => void; hint?: boolean;
}) {
  const selected = parseMiss(value);
  const maxReached = selected.length >= 2;
  return (
    <div className="space-y-1.5">
      {hint && <p className="text-[11px] text-gray-400">ex) 풀훅일 경우 풀과 훅 모두 선택</p>}
      <div className="flex flex-wrap gap-2">
        {options.map(m => {
          const isSelected = selected.includes(m);
          const isDisabled = maxReached && !isSelected;
          const base = 'px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 select-none';
          return (
            <button key={m} disabled={isDisabled} onClick={() => onChange(toggleMiss(value, m))}
              className={`${base} ${isSelected ? 'bg-red-500 border-red-500 text-white cursor-pointer' : isDisabled ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed' : 'bg-red-50 border-red-300 text-red-600 cursor-pointer'}`}>
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeeShotBlock({ par, topResult, subResult, miss, memo, onTopChange, onSubChange, onMissChange, onMemoChange }: {
  par: number; topResult: string; subResult: string; miss: string; memo: string;
  onTopChange: (v: string) => void; onSubChange: (v: string) => void;
  onMissChange: (v: string) => void; onMemoChange: (v: string) => void;
}) {
  const isPar3 = par === 3;
  const topOptions = isPar3 ? ['그린 온 (GIR)', '그린 미스'] : ['페어웨이', '페어웨이 미스'];
  const missLabel = isPar3 ? '그린 미스' : '페어웨이 미스';
  const showSub = topResult === missLabel;
  const missOptions = isPar3 ? TEE_MISS_PAR3 : TEE_MISS_PAR45;

  function handleTopClick(v: string) {
    if (topResult === v) { onTopChange(''); onSubChange(''); }
    else { onTopChange(v); if (v !== missLabel) onSubChange(''); }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-400 mb-1.5">결과</p>
        <div className="flex flex-wrap gap-2">
          {topOptions.map(opt => <Chip key={opt} label={opt} selected={topResult === opt} onClick={() => handleTopClick(opt)} />)}
        </div>
      </div>
      {showSub && (
        <div className="pl-3 border-l-2 border-gray-200 space-y-2">
          <p className="text-xs text-gray-400">세부 위치</p>
          <div className="flex flex-wrap gap-2">
            {TEE_FAIRWAY_MISS_SUB.map(s => {
              const isOBHaz = FAIRWAY_MISS_PENALTY[s] !== undefined;
              return (
                <button key={s} onClick={() => onSubChange(subResult === s ? '' : s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 cursor-pointer select-none ${subResult === s ? isOBHaz ? 'bg-orange-500 border-orange-500 text-white' : 'bg-[#1a6b3a] border-[#1a6b3a] text-white' : isOBHaz ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-400 mb-1.5">미스 유형 (해당 시)</p>
        <MissChips value={miss} options={missOptions} onChange={onMissChange} />
      </div>
      <input type="text" placeholder="메모" value={memo} onChange={e => onMemoChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b3a]/30 focus:border-[#1a6b3a]" />
    </div>
  );
}

function SecondShotBlock({ result, penaltyType, missDetail, miss, memo, isExtra,
  onResultChange, onPenaltyChange, onMissDetailChange, onMissChange, onMemoChange }: {
  result: string; penaltyType: string; missDetail: string; miss: string; memo: string; isExtra?: boolean;
  onResultChange: (v: string) => void; onPenaltyChange: (v: string) => void;
  onMissDetailChange: (v: string) => void; onMissChange: (v: string) => void; onMemoChange: (v: string) => void;
}) {
  const greenOnLabel = isExtra ? '그린 온' : '그린 온 (GIR)';
  const showSub = result === '그린 미스';
  const details = parseDetail<SecondMissDetail>(missDetail);

  function toggleDetail(item: SecondMissDetail) {
    let next: SecondMissDetail[];
    if (SECOND_PENALTY_SUB.includes(item as typeof SECOND_PENALTY_SUB[number])) {
      if (penaltyType === item) { onPenaltyChange(''); next = details.filter(d => !SECOND_PENALTY_SUB.includes(d as typeof SECOND_PENALTY_SUB[number])); }
      else { onPenaltyChange(item); next = [...details.filter(d => !SECOND_PENALTY_SUB.includes(d as typeof SECOND_PENALTY_SUB[number])), item]; }
    } else { next = details.includes(item) ? details.filter(d => d !== item) : [...details, item]; }
    onMissDetailChange(serializeDetail(next));
  }

  function handleTopClick(v: string) {
    onResultChange(result === v ? '' : v);
    if (v !== '그린 미스') { onMissDetailChange(''); onPenaltyChange(''); }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-400 mb-1.5">결과</p>
        <div className="flex flex-wrap gap-2">
          {[greenOnLabel, '그린 미스'].map(opt => <Chip key={opt} label={opt} selected={result === opt} onClick={() => handleTopClick(opt)} />)}
        </div>
      </div>
      {showSub && (
        <div className="pl-3 border-l-2 border-gray-200 space-y-2">
          <p className="text-xs text-gray-400">세부 위치 (복수 선택 가능)</p>
          <div className="flex flex-wrap gap-2">
            {SECOND_GREEN_MISS_SUB.map(s => <Chip key={s} label={s} selected={details.includes(s)} onClick={() => toggleDetail(s)} />)}
            {SECOND_PENALTY_SUB.map(s => (
              <button key={s} onClick={() => toggleDetail(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 cursor-pointer select-none ${penaltyType === s ? 'bg-orange-500 border-orange-500 text-white' : 'bg-orange-50 border-orange-300 text-orange-600'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-400 mb-1.5">미스 유형 (해당 시)</p>
        <MissChips value={miss} options={SECOND_MISS} onChange={onMissChange} />
      </div>
      <input type="text" placeholder="메모" value={memo} onChange={e => onMemoChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b3a]/30 focus:border-[#1a6b3a]" />
    </div>
  );
}

function ApproachBlock({ result, missDetail, miss, memo, onResultChange, onMissDetailChange, onMissChange, onMemoChange }: {
  result: string; missDetail: string; miss: string; memo: string;
  onResultChange: (v: string) => void; onMissDetailChange: (v: string) => void;
  onMissChange: (v: string) => void; onMemoChange: (v: string) => void;
}) {
  const showSub = result === '그린 미스';
  const details = parseDetail<ApproachMissSub>(missDetail);
  const penaltyTotal = details.reduce((s, d) => s + (APPROACH_PENALTY_MAP[d] ?? 0), 0);

  function toggleDetail(item: ApproachMissSub) {
    const isPenalty = APPROACH_PENALTY_MAP[item] !== undefined;
    const next = isPenalty
      ? details.includes(item) ? details.filter(d => d !== item) : [...details.filter(d => APPROACH_PENALTY_MAP[d] === undefined), item]
      : details.includes(item) ? details.filter(d => d !== item) : [...details, item];
    onMissDetailChange(serializeDetail(next));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-400 mb-1.5">결과</p>
        <div className="flex flex-wrap gap-2">
          {APPROACH_RESULTS.map(r => (
            <Chip key={r} label={r} selected={result === r}
              onClick={() => { onResultChange(result === r ? '' : r); if (r !== '그린 미스') onMissDetailChange(''); }} />
          ))}
        </div>
      </div>
      {showSub && (
        <div className="pl-3 border-l-2 border-gray-200 space-y-2">
          <p className="text-xs text-gray-400">세부 위치 (복수 선택 가능)</p>
          <div className="flex flex-wrap gap-2">
            {APPROACH_MISS_SUB.map(s => {
              const isPenalty = APPROACH_PENALTY_MAP[s] !== undefined;
              return (
                <button key={s} onClick={() => toggleDetail(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 cursor-pointer select-none ${details.includes(s) ? isPenalty ? 'bg-orange-500 border-orange-500 text-white' : 'bg-[#1a6b3a] border-[#1a6b3a] text-white' : isPenalty ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {s}
                </button>
              );
            })}
          </div>
          {penaltyTotal > 0 && <p className="text-xs text-orange-500 font-medium">벌타 +{penaltyTotal}타 (스코어 미반영)</p>}
        </div>
      )}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-400 mb-1.5">미스 유형 (해당 시)</p>
        <MissChips value={miss} options={APPROACH_MISS} onChange={onMissChange} />
        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">오버/숏: 20m 이내 어프로치에서 핀을 5m 이상 지나치거나 못 미친 경우</p>
      </div>
      <input type="text" placeholder="메모" value={memo} onChange={e => onMemoChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b3a]/30 focus:border-[#1a6b3a]" />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  round: Round;
  holeNumber: number;
  onBack: () => void;
}

function clearSecondShot(i: 2 | 3): Partial<Hole> {
  return {
    [`second${i}_club`]: '',
    [`second${i}_result`]: '',
    [`second${i}_penalty_type`]: '',
    [`second${i}_miss`]: '',
    [`second${i}_miss_detail`]: '',
    [`second${i}_memo`]: '',
  } as Partial<Hole>;
}

export default function HoleEdit({ round, holeNumber, onBack }: Props) {
  const [hole, setHole] = useState<Hole>(() => ({
    ...emptyHole(round.id, holeNumber),
    ...PAR_DEFAULTS[4],
    total_strokes: PAR_DEFAULTS[4].green_shots + PAR_DEFAULTS[4].putts,
    over_par: 1,
  }));
  const [isManual, setIsManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [secondShotsCount, setSecondShotsCount] = useState(1);
  const [approachCount, setApproachCount] = useState(1);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('holes').select('*')
        .eq('round_id', round.id).eq('hole_number', holeNumber).maybeSingle();
      if (data) {
        const h = data as Hole;
        setHole(h);
        let sc = 1;
        if (h.second3_club || h.second3_result || h.second3_miss) sc = 3;
        else if (h.second2_club || h.second2_result || h.second2_miss) sc = 2;
        setSecondShotsCount(sc);
        setApproachCount((h.approach2_club || h.approach2_miss) ? 2 : 1);
      }
    }
    load();
  }, [round.id, holeNumber]);

  function updateAuto(updates: Partial<Hole>) {
    setIsManual(false);
    setHole(prev => { const next = { ...prev, ...updates }; const t = buildAutoTotal(next); return { ...next, total_strokes: t, over_par: t - next.par }; });
  }

  function updateField(updates: Partial<Hole>) {
    setHole(prev => {
      const next = { ...prev, ...updates };
      if (!isManual) { const t = buildAutoTotal(next); return { ...next, total_strokes: t, over_par: t - next.par }; }
      return { ...next, over_par: next.total_strokes - next.par };
    });
  }

  function adjustManualScore(delta: number) {
    setIsManual(true);
    setHole(prev => { const t = Math.max(1, prev.total_strokes + delta); return { ...prev, total_strokes: t, over_par: t - prev.par }; });
  }

  function handleParChange(p: number) {
    const d = PAR_DEFAULTS[p];
    setIsManual(false);
    setHole(prev => { const next = { ...prev, par: p, green_shots: d.green_shots, putts: d.putts }; const t = buildAutoTotal(next); return { ...next, total_strokes: t, over_par: t - p }; });
  }

  async function handleSave() {
    setSaving(true);
    const { id, ...fields } = { ...hole, is_manual: isManual };
    const { error } = await supabase.from('holes').upsert(fields, { onConflict: 'round_id,hole_number', ignoreDuplicates: false });
    if (error) console.error('[HoleEdit upsert 오류]', error.message);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const scoreStyle = getScoreStyle(hole.par, hole.total_strokes, hole.over_par);
  const scoreName = getScoreName(hole.par, hole.total_strokes, hole.over_par);
  const isMaxScore = hole.total_strokes >= hole.par * 2;
  const secondKeys = ([1, 2, 3] as const).slice(0, secondShotsCount);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#1a6b3a] text-white px-4 pt-4 pb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-green-200 text-sm mb-3 active:opacity-70">
          <ChevronLeft size={16} /> 홀 목록으로
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-200 text-xs">{round.course_name}</p>
            <h2 className="text-2xl font-extrabold">{holeNumber}번 홀 수정</h2>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-extrabold ${hole.over_par > 0 ? 'text-yellow-300' : hole.over_par < 0 ? 'text-blue-200' : 'text-white'}`}>
              {hole.over_par === 0 ? 'E' : hole.over_par > 0 ? `+${hole.over_par}` : hole.over_par}
            </p>
            <p className="text-green-200 text-sm">{hole.total_strokes}타</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 pb-24">
        {/* Par */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">파 선택</div>
          <div className="flex gap-3">
            {[3, 4, 5].map(p => (
              <button key={p} onClick={() => handleParChange(p)}
                className={`flex-1 py-3 rounded-xl font-bold text-base border-2 transition-all active:scale-95 ${hole.par === p ? 'bg-[#1a6b3a] border-[#1a6b3a] text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                파{p}
              </button>
            ))}
          </div>
        </div>

        {/* Score */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className={`border-b-2 ${scoreStyle.border} ${scoreStyle.bg} px-4 py-4`}>
            <div className="flex items-center justify-between">
              <button onClick={() => adjustManualScore(-1)}
                className="w-12 h-12 rounded-full bg-white border border-gray-300 text-gray-600 flex items-center justify-center text-2xl font-bold active:scale-90 transition-transform shadow-sm">−</button>
              <div className="text-center">
                <p className={`text-4xl font-extrabold ${scoreStyle.text}`}>{scoreName}</p>
                <p className={`text-sm mt-0.5 font-medium ${scoreStyle.text} opacity-70`}>
                  {hole.over_par === 0 ? `총 ${hole.total_strokes}타` : `${hole.over_par > 0 ? `+${hole.over_par}` : hole.over_par} · 총 ${hole.total_strokes}타`}
                </p>
              </div>
              <button onClick={() => adjustManualScore(1)} disabled={isMaxScore}
                className="w-12 h-12 rounded-full bg-white border border-gray-300 text-gray-600 flex items-center justify-center text-2xl font-bold active:scale-90 transition-transform shadow-sm disabled:opacity-30">+</button>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {[
              { label: '온그린까지', key: 'green_shots' as const },
              { label: '퍼팅', key: 'putts' as const },
            ].map(({ label, key }) => (
              <div key={key} className="flex flex-col items-center py-4 gap-2">
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateAuto({ [key]: Math.max(0, hole[key] - 1) })}
                    className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 text-gray-600 flex items-center justify-center text-xl font-bold active:scale-90 transition-transform">−</button>
                  <span className="w-7 text-center font-bold text-2xl text-gray-800">
                    {isManual ? <span className="text-gray-300 text-xl">?</span> : hole[key]}
                  </span>
                  <button onClick={() => updateAuto({ [key]: hole[key] + 1 })}
                    className="w-9 h-9 rounded-full bg-[#1a6b3a] text-white flex items-center justify-center text-xl font-bold active:scale-90 transition-transform">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className={`mx-4 mb-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${isManual ? 'bg-orange-50' : 'bg-gray-50'}`}>
            {isManual && <Lock size={11} className="text-orange-400 flex-shrink-0" />}
            <p className={`text-[10px] ${isManual ? 'text-orange-500' : 'text-gray-400'}`}>
              {isManual ? '수동 집계 중. 위 카운터를 누르면 자동 집계로 전환돼요.' : '카운터를 입력하면 자동 집계. 위 +−로 직접 수정 가능.'}
            </p>
          </div>
        </div>

        {/* Tee Shot */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title="티샷" />
          <div className="space-y-3">
            <ClubSelect value={hole.tee_club} onChange={v => updateField({ tee_club: v })} options={TEE_CLUBS} />
            <TeeShotBlock par={hole.par} topResult={hole.tee_result} subResult={hole.tee_penalty_type} miss={hole.tee_miss} memo={hole.tee_memo}
              onTopChange={v => updateField({ tee_result: v })} onSubChange={v => updateField({ tee_penalty_type: v })}
              onMissChange={v => updateField({ tee_miss: v })} onMemoChange={v => updateField({ tee_memo: v })} />
          </div>
        </div>

        {/* Second Shots */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title="세컨샷" />
          <div className="space-y-4">
            {secondKeys.map(i => (
              <div key={i} className={i > 1 ? 'pt-3 border-t border-gray-100' : ''}>
                {secondShotsCount > 1 && (
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400">{i}번째 샷</p>
                    {i > 1 && (
                      <button onClick={() => { updateField(clearSecondShot(i as 2 | 3)); setSecondShotsCount(i - 1); }}
                        className="w-6 h-6 rounded-full bg-red-50 border border-red-200 text-red-500 flex items-center justify-center active:scale-90 transition-transform">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-3">
                  <ClubSelect value={hole[`second${i}_club` as keyof Hole] as string} onChange={v => updateField({ [`second${i}_club`]: v })} options={SHOT_CLUBS} />
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
              <div key={i} className={i > 1 ? 'pt-3 border-t border-gray-100' : ''}>
                {approachCount > 1 && <p className="text-xs font-semibold text-gray-400 mb-2">{i}번째 어프로치</p>}
                <div className="space-y-3">
                  <ClubSelect value={hole[`approach${i}_club` as keyof Hole] as string} onChange={v => updateField({ [`approach${i}_club`]: v })} options={APPROACH_CLUBS} />
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

        {/* Putting */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title="퍼팅" />
          <div className="space-y-3">
            <div className={`flex gap-2 ${isManual ? 'opacity-40 pointer-events-none' : ''}`}>
              {([0, 1, 2, 3, '4+'] as const).map(p => {
                const val = typeof p === 'number' ? p : 4;
                return (
                  <button key={p} onClick={() => updateAuto({ putts: val })}
                    className={`flex-1 py-3 rounded-xl font-bold text-base border-2 transition-all active:scale-95 ${hole.putts === val ? 'bg-[#1a6b3a] border-[#1a6b3a] text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    {p}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 mb-1.5">미스 유형 (해당 시)</p>
              <MissChips value={hole.putt_miss} options={PUTT_MISS} onChange={v => updateField({ putt_miss: v })} hint={false} />
            </div>
            <input type="text" placeholder="메모" value={hole.putt_memo} onChange={e => updateField({ putt_memo: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b3a]/30 focus:border-[#1a6b3a]" />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-100 px-4 pt-3 pb-4 shadow-lg">
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform">
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`flex-[2] py-4 rounded-2xl font-bold text-base active:scale-95 transition-all shadow-lg disabled:opacity-60 ${saved ? 'bg-blue-500 text-white' : 'bg-[#1a6b3a] text-white shadow-green-900/20'}`}>
            {saving ? '저장 중...' : saved ? '저장 완료!' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
