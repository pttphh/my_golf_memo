import { useState, useEffect } from 'react';

import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

import { supabase } from '../lib/supabase';

import type { Hole, Round } from '../types';



interface Props {

  roundId: string;

  onBack: () => void;

  onConfirm: (selectedIndices: number[]) => void;

  onEditHole: (holeNumber: number, existingHole?: Hole) => void;

  onContinue: (holeNumber: number) => void;

  onDelete?: () => void;

}



function formatOverPar(over: number): string {

  if (over === 0) return '파';

  if (over > 0) return `+${over}`;

  return `${over}`;

}



function getPenalties(hole: Hole): { ob: boolean; hazard: boolean } {

  let ob = false;

  let hazard = false;

  for (const p of [

    hole.tee_penalty_type,

    hole.second1_penalty_type,

    hole.second2_penalty_type,

    hole.second3_penalty_type,

  ]) {

    if (p === 'OB') ob = true;

    if (p === '해저드') hazard = true;

  }

  return { ob, hazard };

}



function scoreColor(overPar: number) {

  if (overPar < 0) return 'text-blue-500';

  if (overPar === 0) return 'text-[#1B4332]';

  if (overPar === 1) return 'text-yellow-600';

  if (overPar === 2) return 'text-orange-500';

  return 'text-red-500';

}



function scoreBg(overPar: number) {

  if (overPar < 0) return 'bg-blue-50 border-blue-200';

  if (overPar === 0) return 'bg-green-50 border-green-200';

  if (overPar === 1) return 'bg-yellow-50 border-yellow-200';

  if (overPar === 2) return 'bg-orange-50 border-orange-200';

  return 'bg-red-50 border-red-200';

}



export default function HoleSelect({ roundId, onBack, onConfirm: _onConfirm, onEditHole, onContinue, onDelete }: Props) {

  const [holes, setHoles] = useState<Hole[]>([]);

  const [round, setRound] = useState<Round | null>(null);

  const [loading, setLoading] = useState(true);

  const [showDeleteModal, setShowDeleteModal] = useState(false);



  useEffect(() => {

    async function load() {

      const [{ data: holesData }, { data: roundData }] = await Promise.all([

        supabase.from('holes').select('*').eq('round_id', roundId).order('hole_number'),

        supabase.from('rounds').select('*').eq('id', roundId).single(),

      ]);

      setHoles((holesData ?? []) as Hole[]);

      setRound((roundData ?? null) as Round | null);

      setLoading(false);

    }

    load();

  }, [roundId]);



  const isComplete = holes.length >= 18;

  const savedNumbers = new Set(holes.map(h => h.hole_number));

  const nextHole = isComplete ? null : (

    Array.from({ length: 18 }, (_, i) => i + 1).find(n => !savedNumbers.has(n)) ?? null

  );



  const totalScore = holes.reduce((s, h) => s + h.total_strokes, 0);

  const front9 = holes.filter(h => h.hole_number <= 9);

  const back9 = holes.filter(h => h.hole_number >= 10);

  const front9Over = front9.reduce((s, h) => s + (h.total_strokes - h.par), 0);

  const back9Over = back9.reduce((s, h) => s + (h.total_strokes - h.par), 0);

  const back9Started = back9.length > 0;

  const progressPct = (holes.length / 18) * 100;



  const companions = round

    ? [round.companion1, round.companion2, round.companion3].filter(Boolean).join(' · ')

    : '';

  const frontLabel = round?.course_front ? `전반 (${round.course_front})` : '전반 (1-9홀)';

  const backLabel = round?.course_back ? `후반 (${round.course_back})` : '후반 (10-18홀)';

  if (loading) {

    return (

      <div className="min-h-screen bg-surface flex items-center justify-center">

        <p className="text-gray-500 text-sm">불러오는 중..</p>

      </div>

    );

  }



  function renderGrid(start: number, end: number) {

    return (

      <div className="grid grid-cols-3 gap-3">

        {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(num => {

          const hole = holes.find(h => h.hole_number === num);



          if (!hole) {

            return (

              <button

                key={num}

                onClick={() => onEditHole(num)}

                className="rounded-2xl border-2 border-dashed border-gray-300 p-3 text-center active:scale-95 transition-all hover:border-[#1B4332] hover:bg-green-50"

              >

                <p className="text-xs font-semibold text-gray-500 mb-1">{num}홀</p>

                <p className="text-sm text-gray-500 mb-1">-</p>

                <p className="text-[9px] text-gray-500">탭하여 입력</p>

              </button>

            );

          }



          const overPar = hole.over_par;

          const overStr = overPar > 0 ? `+${overPar}` : overPar === 0 ? '파' : `${overPar}`;

          const { ob, hazard } = getPenalties(hole);



          return (

            <button

              key={num}

              onClick={() => onEditHole(num, hole)}

              className={`w-full rounded-2xl border-2 p-3 text-center transition-all active:scale-95 ${scoreBg(overPar)}`}

            >

              <p className="text-xs font-semibold text-gray-500 mb-0.5">{num}홀 (파{hole.par})</p>

              <p className={`text-lg font-extrabold leading-none ${scoreColor(overPar)}`}>

                {overStr}

              </p>

              <p className="text-[10px] mt-1 text-gray-500">

                {hole.green_shots}온 · {hole.putts}퍼팅

              </p>

              {(ob || hazard) && (

                <div className="flex items-center justify-center gap-1 mt-0.5">

                  {ob && <span className="text-[9px] font-bold text-red-500">OB</span>}

                  {ob && hazard && <span className="text-[9px] text-gray-500">·</span>}

                  {hazard && <span className="text-[9px] font-bold text-orange-500">해저드</span>}

                </div>

              )}

            </button>

          );

        })}

      </div>

    );

  }



  return (

    <div className="min-h-screen bg-surface flex flex-col">

      <div

        className="text-white px-4 pb-3"

        style={{

          position: 'sticky',

          top: 0,

          zIndex: 50,

          backgroundColor: '#1B4332',

          paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',

        }}

      >

        <div className="flex items-center mb-2">

          <button

            onClick={onBack}

            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition-colors flex-shrink-0"

          >

            <ChevronLeft size={18} className="text-white/90" />

          </button>

          <div className="flex-1 text-center min-w-0 px-2">

            {companions ? (

              <p className="text-[10px] text-white/70 truncate leading-tight">{companions}</p>

            ) : null}

            <h2 className="text-xl font-bold leading-tight">홀 기록</h2>

          </div>

          <div className="flex-shrink-0 text-right">

            <span className="text-2xl font-extrabold leading-none" style={{ color: '#ffd700' }}>

              {totalScore}타

            </span>

          </div>

        </div>



        <div className="flex items-end gap-2 mb-2">

          <div className="flex-shrink-0 w-[4.5rem]">

            <p className="text-[10px] text-white/75 leading-tight truncate">{frontLabel}</p>

            <p className="text-sm font-bold mt-0.5">{formatOverPar(front9Over)}</p>

          </div>

          <div className="flex-1 min-w-0 pb-0.5">

            <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">

              <div

                className="h-full bg-white rounded-full transition-all duration-300"

                style={{ width: `${progressPct}%` }}

              />

            </div>

          </div>

          <div className="flex-shrink-0 w-[4.5rem] text-right">

            <p className="text-[10px] text-white/75 leading-tight truncate">{backLabel}</p>

            <p className={`text-sm font-bold mt-0.5 ${back9Started ? '' : 'text-white/40'}`}>

              {back9Started ? formatOverPar(back9Over) : '-'}

            </p>

          </div>

        </div>



        <p className="text-green-200 text-xs text-center">

          {isComplete ? '18홀 완료' : `${holes.length}홀 저장됨`}

          {!isComplete && nextHole !== null && ` · ${nextHole}홀부터 이어서 입력 가능`}

        </p>

      </div>



      <div className="flex-1 px-4 py-5 space-y-4 pb-28">

        {!isComplete && nextHole !== null && (

          <button

            onClick={() => onContinue(nextHole)}

            className="w-full flex items-center justify-between bg-[#1B4332] text-white px-4 py-3.5 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform shadow-lg shadow-green-900/20"

          >

            <span>{nextHole}번 홀부터 이어서 입력하기</span>

            <ChevronRight size={16} />

          </button>

        )}



        <p className="text-sm text-gray-500">각 홀을 탭하여 수정할 수 있어요</p>



        <div>

          <div className="flex items-center gap-2 mb-2">

            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{frontLabel}</span>

            <div className="flex-1 h-px bg-gray-200" />

          </div>

          {renderGrid(1, 9)}

        </div>



        <div>

          <div className="flex items-center gap-2 mb-2">

            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{backLabel}</span>

            <div className="flex-1 h-px bg-gray-200" />

          </div>

          {renderGrid(10, 18)}

        </div>



        {onDelete && (

          <button

            onClick={() => setShowDeleteModal(true)}

            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-red-300 text-red-500 font-semibold text-sm active:scale-95 transition-transform mt-4"

          >

            <Trash2 size={16} />

            이 라운드 삭제

          </button>

        )}

      </div>



      {showDeleteModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">

          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteModal(false)} />

          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-[320px]">

            <h3 className="text-base font-bold text-gray-900 mb-2">라운드를 삭제할까요?</h3>

            <p className="text-sm text-gray-500 mb-6">삭제된 데이터는 복구할 수 없어요.</p>

            <div className="flex gap-3">

              <button onClick={() => setShowDeleteModal(false)}

                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform">

                취소

              </button>

              <button onClick={() => { setShowDeleteModal(false); onDelete?.(); }}

                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-transform">

                삭제

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}

