import { useState, useEffect } from 'react';
import { Trophy, Target, AlertTriangle, BarChart2, ChevronRight, List, Trash2, TrendingDown, Flag, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round, Hole } from '../types';
import { collectMissPatterns } from '../lib/missPattern';

interface Props {
  round: Round;
  viewMode: 'recording' | 'view';
  onSave: () => void;
  onDelete: () => void;
  onMissBreakdown: () => void;
  onViewHoles: () => void;
}

type SegmentType = 'tee' | 'second' | 'approach' | 'putt';

const SEGMENTS: { id: SegmentType; label: string }[] = [
  { id: 'tee', label: '티샷' },
  { id: 'second', label: '세컨샷' },
  { id: 'approach', label: '어프로치' },
  { id: 'putt', label: '퍼팅' },
];

const CRITICAL_MISS = ['어프로치 불가', 'OB', '해저드'] as const;
const MISS_BAR_COLORS = ['#E24B4A', '#E24B4A', '#EF9F27', '#EF9F27', '#B4B2A9'];
const PENALTY_MAP: Record<string, number> = { OB: 2, '해저드': 1 };

function secondPenaltyFields(h: Hole): string[] {
  return [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type];
}

function allPenaltyFields(h: Hole): string[] {
  return [h.tee_penalty_type, h.tee2_penalty_type, ...secondPenaltyFields(h)];
}

function holeHasCriticalMiss(h: Hole): boolean {
  return secondPenaltyFields(h).some(p =>
    CRITICAL_MISS.includes(p as typeof CRITICAL_MISS[number]),
  );
}

function countHolesWithPenalty(holes: Hole[], type: string): number {
  return holes.filter(h => allPenaltyFields(h).includes(type)).length;
}

function topMissBars(raws: string[], limit = 5) {
  const counts = collectMissPatterns(raws);
  return Object.entries(counts)
    .map(([type, count]) => ({ type, avg: count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, limit);
}

function MetricCell({ label, value, valueClass = 'text-gray-800' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-2 text-center">
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-1 leading-tight">{label}</p>
    </div>
  );
}

function RankedMissBarChart({ items }: { items: { type: string; avg: number }[] }) {
  const max = Math.max(...items.map(i => i.avg), 1);
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-2">데이터 없음</p>;
  }
  return (
    <div className="space-y-2.5">
      {items.map(({ type, avg: a }, idx) => (
        <div key={type} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-16 flex-shrink-0 truncate">{type}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(a / max) * 100}%`, backgroundColor: MISS_BAR_COLORS[idx] ?? '#B4B2A9' }}
            />
          </div>
          <span className="text-xs font-bold min-w-[32px] text-right text-gray-700">{a}회</span>
        </div>
      ))}
    </div>
  );
}

function ColoredBarChart({ items }: { items: { label: string; avg: number; color: string }[] }) {
  const max = Math.max(...items.map(i => i.avg), 1);
  return (
    <div className="space-y-2.5">
      {items.map(({ label, avg: a, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-16 flex-shrink-0">{label}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(a / max) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="text-xs font-bold min-w-[32px] text-right text-gray-700">{a}회</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card rounded-2xl p-3.5 border border-gray-100 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-[#1B4332] flex-shrink-0">
          {icon}
        </div>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-800 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

function roundToEditForm(r: Round) {
  return {
    course_name: r.course_name,
    course_front: r.course_front ?? '',
    course_back: r.course_back ?? '',
    date: r.date,
    time: r.time ?? '',
    companion1: r.companion1 ?? '',
    companion2: r.companion2 ?? '',
    companion3: r.companion3 ?? '',
  };
}

type EditForm = ReturnType<typeof roundToEditForm>;

function EditModal({
  form,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  form: EditForm;
  saving: boolean;
  onChange: (updates: Partial<EditForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const inputCls =
    'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332] text-gray-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-card rounded-2xl shadow-2xl p-6 w-full max-w-[340px] max-h-[85vh] overflow-y-auto">
        <h3 className="text-base font-bold text-gray-800 text-center mb-4">라운드 정보 수정</h3>
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">골프장 이름</label>
            <input type="text" value={form.course_name} onChange={e => onChange({ course_name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">전반 코스명</label>
            <input type="text" value={form.course_front} onChange={e => onChange({ course_front: e.target.value })} placeholder="예) OUT, 레이크" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">후반 코스명</label>
            <input type="text" value={form.course_back} onChange={e => onChange({ course_back: e.target.value })} placeholder="예) IN, 마운틴" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">날짜</label>
            <input type="date" value={form.date} onChange={e => onChange({ date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">시간</label>
            <input type="text" value={form.time} onChange={e => onChange({ time: e.target.value })} placeholder="예) 08:00" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">동반자1</label>
            <input type="text" value={form.companion1} onChange={e => onChange({ companion1: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">동반자2</label>
            <input type="text" value={form.companion2} onChange={e => onChange({ companion2: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">동반자3</label>
            <input type="text" value={form.companion3} onChange={e => onChange({ companion3: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={saving}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50">
            취소
          </button>
          <button onClick={onSave} disabled={saving || !form.course_name.trim()}
            className="flex-1 py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ onConfirm, onCancel, deleting }: { onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-card rounded-2xl shadow-2xl p-6 w-full max-w-[340px]">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-base font-bold text-gray-800 text-center mb-2">라운드 삭제</h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
          이 라운드를 삭제하시겠습니까?<br />삭제한 데이터는 복구할 수 없습니다.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50">
            취소
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50">
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoundSummary({ round, viewMode, onSave, onDelete, onMissBreakdown, onViewHoles }: Props) {
  const [roundData, setRoundData] = useState<Round>(round);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(() => roundToEditForm(round));
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeSegment, setActiveSegment] = useState<SegmentType>('tee');

  useEffect(() => {
    setRoundData(round);
  }, [round]);

  useEffect(() => {
    async function fetchHoles() {
      setLoading(true);
      const { data, error } = await supabase
        .from('holes')
        .select('*')
        .eq('round_id', roundData.id)
        .order('hole_number');
      console.log('[RoundSummary] round_id:', roundData.id, '| holes:', data?.length, '| error:', error);
      setHoles((data ?? []) as Hole[]);
      setLoading(false);
    }
    fetchHoles();
  }, [roundData.id]);

  const totalStrokes = holes.reduce((s, h) => s + h.total_strokes, 0);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const totalOver = totalStrokes - totalPar;

  const front9 = holes.filter(h => h.hole_number <= 9);
  const back9 = holes.filter(h => h.hole_number >= 10);
  const front9Score = front9.reduce((s, h) => s + h.total_strokes, 0);
  const back9Score = back9.reduce((s, h) => s + h.total_strokes, 0);
  const front9Par = front9.reduce((s, h) => s + h.par, 0);
  const back9Par = back9.reduce((s, h) => s + h.par, 0);

  const scoreDist = {
    birdie: holes.filter(h => h.over_par <= -1).length,
    par: holes.filter(h => h.over_par === 0).length,
    bogey: holes.filter(h => h.over_par === 1).length,
    double: holes.filter(h => h.over_par === 2).length,
    triple: holes.filter(h => h.over_par >= 3).length,
  };

  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const threePuttPlus = holes.filter(h => h.putts >= 3).length;

  const PENALTY_MAP_LOCAL = PENALTY_MAP;
  const penalties = holes.reduce((s, h) => {
    let pen = 0;
    for (const p of allPenaltyFields(h)) {
      pen += PENALTY_MAP_LOCAL[p] ?? 0;
    }
    return s + pen;
  }, 0);

  const doubleOrWorse = holes.filter(h => h.over_par >= 2).length;
  const yangpaCount = holes.filter(h => h.total_strokes >= h.par * 2).length;
  const par45WithTee = holes.filter(h => h.par !== 3 && h.tee_result);
  const fairwayHits = par45WithTee.filter(h => h.tee_result === '페어웨이').length;
  const fairwayPct = par45WithTee.length > 0 ? Math.round((fairwayHits / par45WithTee.length) * 100) : 0;

  const girCount = holes.filter(
    h => h.tee_result === '그린 온(GIR)' || h.second1_result === '그린 온(GIR)',
  ).length;
  const girPct = holes.length > 0 ? Math.round((girCount / holes.length) * 100) : 0;

  const approachSuccess = holes.filter(
    h => h.approach1_result === '성공' || h.approach2_result === '성공',
  ).length;
  const approachAttempts = holes.filter(
    h => ['20m이내', '20~40m'].includes(h.approach1_club ?? '') ||
         ['20m이내', '20~40m'].includes(h.approach2_club ?? ''),
  ).length;
  const approachPct = approachAttempts > 0
    ? Math.round((approachSuccess / approachAttempts) * 100)
    : 0;

  const criticalMissHoles = holes.filter(holeHasCriticalMiss).length;
  const criticalOb = holes.filter(h => secondPenaltyFields(h).includes('OB')).length;
  const criticalHazard = holes.filter(h => secondPenaltyFields(h).includes('해저드')).length;
  const criticalNoApproach = holes.filter(h => secondPenaltyFields(h).includes('어프로치 불가')).length;

  const puttMissHoles = holes.filter(h => h.putt_miss);
  const shortPuttSuccess = puttMissHoles.filter(h => h.putt_miss === '숏퍼팅 성공').length;
  const shortPuttPct = puttMissHoles.length > 0
    ? Math.round((shortPuttSuccess / puttMissHoles.length) * 100)
    : 0;

  const obHoles = countHolesWithPenalty(holes, 'OB');
  const hazardHoles = countHolesWithPenalty(holes, '해저드');

  const segFairwayPct = fairwayPct;
  const segCriticalMiss = criticalMissHoles;
  const segGir = girCount;
  const segSecondPenaltyRate = holes.length > 0
    ? Math.round((holes.filter(h =>
        h.second1_penalty_type === 'OB' || h.second1_penalty_type === '해저드' ||
        h.second2_penalty_type === 'OB' || h.second2_penalty_type === '해저드' ||
        h.second3_penalty_type === 'OB' || h.second3_penalty_type === '해저드',
      ).length / holes.length) * 100)
    : 0;
  const approach20Rate = (() => {
    const attempts = holes.filter(h => h.approach1_club === '20m이내');
    if (!attempts.length) return 0;
    return Math.round((attempts.filter(h => h.approach1_result === '성공').length / attempts.length) * 100);
  })();
  const approach2040Rate = (() => {
    const attempts = holes.filter(h => h.approach1_club === '20~40m');
    if (!attempts.length) return 0;
    return Math.round((attempts.filter(h => h.approach1_result === '성공').length / attempts.length) * 100);
  })();
  const avgPuttsPerHole = holes.length > 0
    ? Math.round((totalPutts / holes.length) * 10) / 10
    : 0;
  const shortPuttMissCount = holes.filter(h => h.putt_miss === '숏퍼팅 실패' || h.putt2_miss === '숏퍼팅 실패').length;
  const putt1 = holes.filter(h => h.putts === 1).length;
  const putt2 = holes.filter(h => h.putts === 2).length;
  const putt3 = holes.filter(h => h.putts === 3).length;
  const putt4plus = holes.filter(h => h.putts >= 4).length;

  const teeMissBars = topMissBars(holes.map(h => h.tee_miss).filter(Boolean));
  const secondMissBars = topMissBars(
    holes.flatMap(h => [h.second1_miss, h.second2_miss, h.second3_miss].filter(Boolean)),
  );
  const approachMissBars = topMissBars(
    holes.flatMap(h => [h.approach1_miss, h.approach2_miss].filter(Boolean)),
  );

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 200));
    setSaving(false);
    onSave();
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setShowDeleteModal(false);
  }

  function openEditModal() {
    setEditForm(roundToEditForm(roundData));
    setShowEditModal(true);
  }

  async function handleEditSave() {
    if (!editForm.course_name.trim()) return;
    setEditSaving(true);
    const payload = {
      course_name: editForm.course_name.trim(),
      course_front: editForm.course_front.trim(),
      course_back: editForm.course_back.trim(),
      date: editForm.date,
      time: editForm.time.trim(),
      companion1: editForm.companion1.trim(),
      companion2: editForm.companion2.trim(),
      companion3: editForm.companion3.trim(),
    };
    const { error } = await supabase.from('rounds').update(payload).eq('id', roundData.id);
    setEditSaving(false);
    if (error) {
      console.error('[RoundSummary edit]', error.message);
      return;
    }
    setRoundData({ ...roundData, ...payload });
    setShowEditModal(false);
  }

  const overSign = totalOver >= 0 ? `+${totalOver}` : `${totalOver}`;
  const f9Sign = (front9Score - front9Par) >= 0 ? `+${front9Score - front9Par}` : `${front9Score - front9Par}`;
  const b9Sign = (back9Score - back9Par) >= 0 ? `+${back9Score - back9Par}` : `${back9Score - back9Par}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

      {showEditModal && (
        <EditModal
          form={editForm}
          saving={editSaving}
          onChange={updates => setEditForm(prev => ({ ...prev, ...updates }))}
          onSave={handleEditSave}
          onCancel={() => setShowEditModal(false)}
        />
      )}

      <div className="min-h-screen bg-surface flex flex-col">
      <div className="bg-[#1B4332] text-white px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
          <p className="text-green-200 text-xs mb-1">{roundData.date}  · {roundData.time}</p>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{roundData.course_name}</h2>
            <button
              type="button"
              onClick={openEditModal}
              className="p-1 active:opacity-70 transition-opacity flex-shrink-0"
              aria-label="라운드 정보 수정"
            >
              <Pencil size={14} className="text-green-300" />
            </button>
          </div>
          {(roundData.companion1 || roundData.companion2 || roundData.companion3) && (
  <div className="flex gap-1.5 mt-1.5 flex-wrap">
    {[roundData.companion1, roundData.companion2, roundData.companion3].filter(Boolean).map((name, i) => (
      <span key={i} className="text-xs bg-green-800/50 text-green-200 px-2 py-0.5 rounded-full">{name}</span>
    ))}
  </div>
)}
          {holes.length === 0 ? (
            <p className="mt-4 text-green-200 text-sm">홀 기록이 없습니다.</p>
          ) : (
            <>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-5xl font-extrabold">{totalStrokes}타</span>
                <span className="text-green-200 text-xl font-semibold pb-1">{overSign} 오버파</span>
              </div>
              <div className="mt-4 flex gap-3">
                <div className="flex-1 bg-green-800/50 rounded-xl p-3 text-center">
                <p className="text-green-200 text-xs mb-1">전반 {roundData.course_front ? `(${roundData.course_front})` : '(1-9홀)'}</p>
                  <p className="text-white font-bold text-xl">{front9Score}</p>
                  <p className="text-green-300 text-sm">{f9Sign}</p>
                </div>
                <div className="flex-1 bg-green-800/50 rounded-xl p-3 text-center">
                <p className="text-green-200 text-xs mb-1">후반 {roundData.course_back ? `(${roundData.course_back})` : '(10-18홀)'}</p>
                  <p className="text-white font-bold text-xl">{back9Score}</p>
                  <p className="text-green-300 text-sm">{b9Sign}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-5 space-y-5 pb-28">
          {holes.length > 0 && (
            <>
              <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">홀별 결과 분포</h3>
                <div className="grid grid-cols-5 gap-1">
                  {[
{ label: '버디↓', count: scoreDist.birdie, color: 'bg-blue-100', text: 'text-blue-600' },
{ label: '파', count: scoreDist.par, color: 'bg-green-100', text: 'text-green-800' },
{ label: '보기', count: scoreDist.bogey, color: 'bg-amber-100', text: 'text-amber-600' },
{ label: '더블', count: scoreDist.double, color: 'bg-orange-100', text: 'text-orange-600' },
{ label: '트리플↑', count: scoreDist.triple, color: 'bg-red-100', text: 'text-red-500' },
                  ].map(({ label, count, color, text }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className={`w-full rounded-xl py-2.5 text-center font-extrabold text-xl ${color} ${text}`}>{count}</div>                      <span className={`text-xs font-medium ${text}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<TrendingDown size={16} />} label="더블보기 이상" value={`${doubleOrWorse} / 18`} sub={`양파 ${yangpaCount}홀`} />
                <StatCard icon={<AlertTriangle size={16} />} label="손실 타수" value={`${penalties}타`} sub={`OB ${obHoles}홀 · 해저드 ${hazardHoles}홀`} />
                <StatCard icon={<Flag size={16} />} label="페어웨이 안착률" value={`${fairwayPct}%`} sub={`${fairwayHits} / ${par45WithTee.length}`} />
                <StatCard icon={<Trophy size={16} />} label="GIR" value={`${girPct}%`} sub={`${girCount} / ${holes.length}`} />
                <StatCard icon={<AlertTriangle size={16} />} label="세컨샷 치명미스" value={`${criticalMissHoles}홀`} sub={`OB ${criticalOb} · 해저드 ${criticalHazard} · 어프로치불가 ${criticalNoApproach}`} />
                <StatCard icon={<Target size={16} />} label="어프로치 성공률" value={`${approachPct}%`} sub={`${approachSuccess} / ${approachAttempts}홀 성공`} />
                <StatCard icon={<Target size={16} />} label="퍼팅" value={`총 ${totalPutts}개`} sub={`3퍼팅 이상 ${threePuttPlus}홀`} />
                <StatCard icon={<Target size={16} />} label="숏퍼팅 성공률" value={`${shortPuttPct}%`} sub={`성공 ${shortPuttSuccess} / 전체 ${puttMissHoles.length}`} />
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-500 px-1">구간별 분석</p>
                <div
                  className="flex gap-2 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {SEGMENTS.map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setActiveSegment(id)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                        activeSegment === id
                          ? 'bg-[#1B4332] text-white border-[#1B4332]'
                          : 'border-gray-200 text-gray-600 bg-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeSegment === 'tee' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">티샷</h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <MetricCell label="페어웨이 안착률" value={`${segFairwayPct}%`} valueClass="text-amber-600" />
                      <MetricCell label="평균 벌타" value={`${penalties}타`} valueClass="text-red-500" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">미스 TOP5</p>
                    <RankedMissBarChart items={teeMissBars} />
                  </div>
                )}

                {activeSegment === 'second' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">세컨샷</h3>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <MetricCell label="치명미스" value={`${segCriticalMiss}`} valueClass="text-red-500" />
                      <MetricCell label="GIR" value={`${segGir}홀`} valueClass="text-amber-600" />
                      <MetricCell label="세컨 페널티율" value={`${segSecondPenaltyRate}%`} valueClass="text-red-500" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">미스 TOP5</p>
                    <RankedMissBarChart items={secondMissBars} />
                  </div>
                )}

                {activeSegment === 'approach' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">어프로치</h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <MetricCell label="20m이내 3m안착" value={`${approach20Rate}%`} valueClass="text-teal-600" />
                      <MetricCell label="20~40m 5m안착" value={`${approach2040Rate}%`} valueClass="text-amber-600" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">미스 TOP5</p>
                    <RankedMissBarChart items={approachMissBars} />
                  </div>
                )}

                {activeSegment === 'putt' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">퍼팅</h3>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <MetricCell label="평균 퍼팅" value={`${avgPuttsPerHole}`} valueClass="text-blue-500" />
                      <MetricCell label="3퍼팅 이상" value={`${threePuttPlus}홀`} valueClass="text-red-500" />
                      <MetricCell label="숏퍼팅 미스" value={`${shortPuttMissCount}`} valueClass="text-amber-600" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">홀별 퍼팅 분포</p>
                    <ColoredBarChart
                      items={[
                        { label: '1퍼팅', avg: putt1, color: '#1D9E75' },
                        { label: '2퍼팅', avg: putt2, color: '#378ADD' },
                        { label: '3퍼팅', avg: putt3, color: '#EF9F27' },
                        { label: '4퍼팅+', avg: putt4plus, color: '#E24B4A' },
                      ]}
                    />
                  </div>
                )}

              </div>

              <button onClick={onMissBreakdown}
                className="w-full bg-white border-2 border-[#1B4332]/30 text-[#1B4332] py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <BarChart2 size={16} />
                미스 유형 집계 보기
                <ChevronRight size={14} />
              </button>

              <button onClick={onViewHoles}
                className="w-full bg-white border-2 border-[#1B4332]/30 text-[#1B4332] py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <List size={16} />
                각 홀 기록 보기
                <ChevronRight size={14} />
              </button>
            </>
          )}

          {viewMode === 'recording' ? (
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-[#1B4332] text-white py-4 rounded-2xl font-bold text-base active:scale-95 transition-transform disabled:opacity-60 shadow-lg shadow-green-900/20">
              {saving ? '저장 중...' : '라운드 저장 완료'}
            </button>
          ) : (
            <button onClick={() => setShowDeleteModal(true)}
              className="w-full bg-white border-2 border-red-400 text-red-500 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Trash2 size={18} />
              이 라운드 삭제
            </button>
          )}
        </div>
      </div>
    </>
  );
}
