import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round } from '../types';

interface Props {
  onStart: (round: Round) => void;
}

function getNowDateTimeLocal() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function NewRound({ onStart }: Props) {
  const [dateTime, setDateTime] = useState(getNowDateTimeLocal());
  const [courseName, setCourseName] = useState('');
  const [courseFront, setCourseFront] = useState('');
  const [courseBack, setCourseBack] = useState('');
  const [companions, setCompanions] = useState<string[]>([]);
  const [companionInput, setCompanionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function addCompanion() {
    const name = companionInput.trim();
    if (!name || companions.length >= 3) return;
    setCompanions([...companions, name]);
    setCompanionInput('');
  }

  function removeCompanion(i: number) {
    setCompanions(companions.filter((_, idx) => idx !== i));
  }

  async function handleStart() {
    if (loading) return;
    if (!courseName.trim()) {
      setError('골프장 이름을 입력해 주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const date = dateTime.slice(0, 10);
      const time = dateTime.slice(11, 16);
      const payload = {
        date,
        time,
        course_name: courseName.trim(),
        course_front: courseFront.trim(),
        course_back: courseBack.trim(),
        companion1: companions[0] ?? '',
        companion2: companions[1] ?? '',
        companion3: companions[2] ?? '',
      };
      const { data: insertedRound, error: err } = await supabase
        .from('rounds')
        .insert(payload)
        .select('id')
        .single();
      if (err || !insertedRound) { setError('라운드 생성 실패'); return; }
      onStart({ ...payload, id: insertedRound.id });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
      setError(`오류: ${msg}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f9f7] flex flex-col">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">새 라운드</h1>
        <p className="text-gray-500 text-sm mt-0.5">라운드 정보를 입력하세요</p>
      </div>

      <div className="flex-1 px-4 pb-28 space-y-4">
        {/* Date & Time */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">날짜 & 시간</h2>
  <div>
    <label className="block text-xs text-gray-500 mb-1">날짜</label>
    <input
      type="date"
      value={dateTime.slice(0, 10)}
      onChange={e => setDateTime(e.target.value + 'T' + dateTime.slice(11, 16))}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332] text-gray-700"
    />
  </div>
  <div>
    <label className="block text-xs text-gray-500 mb-1">시간</label>
    <input
      type="time"
      value={dateTime.slice(11, 16)}
      onChange={e => setDateTime(dateTime.slice(0, 10) + 'T' + e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332] text-gray-700"
    />
  </div>
</div>

        {/* Course */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">골프장</h2>
          <input
            type="text"
            placeholder="골프장 이름 입력"
            value={courseName}
            onChange={e => setCourseName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">코스 <span className="text-gray-500">(선택)</span></label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="전반 코스명"
                value={courseFront}
                onChange={e => setCourseFront(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
              />
              <input
                type="text"
                placeholder="후반 코스명"
                value={courseBack}
                onChange={e => setCourseBack(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
              />
            </div>
          </div>
        </div>

        {/* Companions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">동반자 ({companions.length}/3)</h2>
          {companions.map((name, i) => (
            <div key={i} className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <div className="w-6 h-6 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
              <span className="flex-1 text-sm text-gray-800">{name}</span>
              <button onClick={() => removeCompanion(i)} className="text-gray-500 hover:text-red-500 transition-colors p-0.5">
                <X size={15} />
              </button>
            </div>
          ))}
          {companions.length < 3 && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="동반자 이름"
                value={companionInput}
                onChange={e => setCompanionInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCompanion()}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
              />
              <button
                onClick={addCompanion}
                disabled={!companionInput.trim()}
                className="w-10 h-10 rounded-xl bg-[#1B4332] text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
              >
                <Plus size={18} />
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full bg-[#1B4332] text-white py-4 rounded-2xl font-bold text-base active:scale-95 transition-transform disabled:opacity-60 shadow-lg shadow-green-900/20"
        >
          {loading ? '시작 중...' : '라운드 시작'}
        </button>
      </div>
    </div>
  );
}