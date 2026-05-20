import { useState, useEffect } from 'react';
import { Trophy, Target, AlertTriangle, BarChart2, ChevronRight, List, Trash2, TrendingDown, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round, Hole } from '../types';

interface Props {
  round: Round;
  viewMode: 'recording' | 'view';
  onSave: () => void;
  onDelete: () => void;
  onMissBreakdown: () => void;
  onViewHoles: () => void;
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

function DeleteModal({ onConfirm, onCancel, deleting }: { onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-card rounded-2xl shadow-2xl p-6 w-full max-w-[340px]">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-base font-bold text-gray-800 text-center mb-2">??????? ?????</h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
          ? ???????? ?????????????????????<br />??????? ???????? ????? ??? ????????????.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50">
            ????
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50">
            {deleting ? '????? ??...' : '?????'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoundSummary({ round, viewMode, onSave, onDelete, onMissBreakdown, onViewHoles }: Props) {
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchHoles() {
      setLoading(true);
      const { data, error } = await supabase
        .from('holes')
        .select('*')
        .eq('round_id', round.id)
        .order('hole_number');
      console.log('[RoundSummary] round_id:', round.id, '| holes:', data?.length, '| error:', error);
      setHoles((data ?? []) as Hole[]);
      setLoading(false);
    }
    fetchHoles();
  }, [round.id]);

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

  const PENALTY_MAP: Record<string, number> = { OB: 2, '????????': 1 };
  const penalties = holes.reduce((s, h) => {
    let pen = 0;
    for (const p of [h.tee_penalty_type, h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      pen += PENALTY_MAP[p] ?? 0;
    }
    return s + pen;
  }, 0);

  const gir = holes.filter(h => {
    const requiredShots = h.par - 2;
    return h.green_shots <= requiredShots && h.green_shots > 0;
  }).length;

  const doubleOrWorse = holes.filter(h => h.over_par >= 2).length;
  const par3Holes = holes.filter(h => h.par === 3).length;
  const fairwayDenom = 18 - par3Holes;
  const fairwayHits = holes.filter(h => h.par !== 3 && h.tee_result === '??????????').length;
  const fairwayPct = fairwayDenom > 0 ? Math.round((fairwayHits / fairwayDenom) * 100) : 0;

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

  const overSign = totalOver >= 0 ? `+${totalOver}` : `${totalOver}`;
  const f9Sign = (front9Score - front9Par) >= 0 ? `+${front9Score - front9Par}` : `${front9Score - front9Par}`;
  const b9Sign = (back9Score - back9Par) >= 0 ? `+${back9Score - back9Par}` : `${back9Score - back9Par}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-gray-500 text-sm">??????????? ??...</p>
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

      <div className="min-h-screen bg-surface flex flex-col">
        <div className="bg-[#1B4332] text-white px-4 pt-4 pb-4">
          <p className="text-green-200 text-xs mb-1">{round.date} · {round.time}</p>
          <h2 className="text-xl font-bold">{round.course_name}</h2>
          {(round.course_front || round.course_back) && (
            <div className="flex gap-2 mt-1.5">
              {round.course_front && (
                <span className="text-xs bg-green-800/50 text-green-200 px-2 py-0.5 rounded-full">???? {round.course_front}</span>
              )}
              {round.course_back && (
                <span className="text-xs bg-green-800/50 text-green-200 px-2 py-0.5 rounded-full">????? {round.course_back}</span>
              )}
            </div>
          )}
          {holes.length === 0 ? (
            <p className="mt-4 text-green-200 text-sm">??? ??? ????????????.</p>
          ) : (
            <>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-5xl font-extrabold">{totalStrokes}???</span>
                <span className="text-green-200 text-xl font-semibold pb-1">{overSign} ????????</span>
              </div>
              <div className="mt-4 flex gap-3">
                <div className="flex-1 bg-green-800/50 rounded-xl p-3 text-center">
                  <p className="text-green-200 text-xs mb-1">???? (1-9???)</p>
                  <p className="text-white font-bold text-xl">{front9Score}</p>
                  <p className="text-green-300 text-sm">{f9Sign}</p>
                </div>
                <div className="flex-1 bg-green-800/50 rounded-xl p-3 text-center">
                  <p className="text-green-200 text-xs mb-1">????? (10-18???)</p>
                  <p className="text-white font-bold text-xl">{back9Score}</p>
                  <p className="text-green-300 text-sm">{b9Sign}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-5 space-y-5">
          {holes.length > 0 && (
            <>
              <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">????? ?? ???</h3>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { label: '????????', count: scoreDist.birdie, color: 'bg-blue-500', text: 'text-blue-600' },
                    { label: '???', count: scoreDist.par, color: 'bg-[#1B4332]', text: 'text-[#1B4332]' },
                    { label: '??', count: scoreDist.bogey, color: 'bg-yellow-400', text: 'text-yellow-600' },
                    { label: '????', count: scoreDist.double, color: 'bg-orange-400', text: 'text-orange-600' },
                    { label: '??????????', count: scoreDist.triple, color: 'bg-red-500', text: 'text-red-600' },
                  ].map(({ label, count, color, text }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className={`w-full rounded-xl py-2.5 text-white text-center font-extrabold text-xl ${color}`}>{count}</div>
                      <span className={`text-xs font-medium ${text}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<Flag size={16} />} label="?????????? ?????" value={`${fairwayHits} / ${fairwayDenom}`} sub={`${fairwayPct}%`} />
                <StatCard icon={<Trophy size={16} />} label="GIR" value={`${gir} / 18`} sub="?? ??? ???" />
                <StatCard icon={<Target size={16} />} label="3????+" value={`${threePuttPlus}???`} sub="3???? ????" />
                <StatCard icon={<Target size={16} />} label="? ????" value={`${totalPutts}??`} />
                <StatCard icon={<TrendingDown size={16} />} label="???? ????" value={`${doubleOrWorse} / 18`} sub="?????? ????" />
                <StatCard icon={<AlertTriangle size={16} />} label="????? ??????" value={`${penalties}???`} sub="OB??2, ??????????1" />
              </div>

              <button onClick={onMissBreakdown}
                className="w-full bg-white border-2 border-[#1B4332]/30 text-[#1B4332] py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <BarChart2 size={16} />
                ???? ?????? ???? ??
                <ChevronRight size={14} />
              </button>

              <button onClick={onViewHoles}
                className="w-full bg-white border-2 border-[#1B4332]/30 text-[#1B4332] py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <List size={16} />
                ? ??? ?? ??
                <ChevronRight size={14} />
              </button>
            </>
          )}

          {viewMode === 'recording' ? (
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-[#1B4332] text-white py-4 rounded-2xl font-bold text-base active:scale-95 transition-transform disabled:opacity-60 shadow-lg shadow-green-900/20">
              {saving ? '????? ??...' : '??????? ????? ?????'}
            </button>
          ) : (
            <button onClick={() => setShowDeleteModal(true)}
              className="w-full bg-white border-2 border-red-400 text-red-500 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Trash2 size={18} />
              ? ??????? ?????
            </button>
          )}
        </div>
      </div>
    </>
  );
}
