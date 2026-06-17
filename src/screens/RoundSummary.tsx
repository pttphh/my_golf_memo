import { useState, useEffect } from 'react';
import { Trophy, Target, AlertTriangle, BarChart2, ChevronRight, List, Trash2, Flag, Pencil, Crosshair, Disc, CheckCircle, Share2, TicketX, PlayOff, MapPinCheck, Ban, Zap, Route, MapPinOff, Locate } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isAnonymousUser, signUpWithEmail, signUpNewUser } from '../lib/auth';
import type { Round, Hole } from '../types';
import { collectMissPatterns } from '../lib/missPattern';
import {
  SegmentLineChart,
  SegmentCardFootnote,
  computeRoundPenaltyStrokes,
  computeRoundFatalMissCount,
  computeRoundApproachTrendPct,
  computeRoundShortPuttMissCount,
  computeTeePenaltyStrokes,
  computeFairwayPct,
  computeGirCount,
  computeWedgeSuccessRate,
  computeApproach20Pct,
  computeApproach2040Pct,
  computeTotalPutts,
  computeThreePuttCount,
  computeShortPuttSuccessRate,
  chartPointsAvg,
} from '../components/SegmentChart';

interface Props {
  round: Round;
  viewMode: 'recording' | 'view';
  shareMode?: boolean;
  holes?: Hole[];
  onSave?: () => void;
  onDelete?: () => void;
  onMissBreakdown?: () => void;
  onViewHoles?: () => void;
}

type SegmentType = 'tee' | 'second' | 'approach' | 'putt';

const SEGMENTS: { id: SegmentType; label: string }[] = [
  { id: 'tee', label: '티샷' },
  { id: 'second', label: '세컨샷' },
  { id: 'approach', label: '어프로치' },
  { id: 'putt', label: '퍼팅' },
];

type MetricInfo = {
  title: string;
  description: string;
  criteria: string[];
  goalsLabel: string;
  goals: { level: string; target: string }[];
};

const METRIC_INFO: Record<string, MetricInfo> = {
  손실타수: {
    title: '손실 타수',
    description: 'OB, 해저드처럼 공을 잃거나 벌타를 받은 상황에서 잃은 타수입니다. 이 앱에서는 OB 1회 = 2타 손실, 해저드 1회 = 1타 손실로 계산합니다.',
    criteria: ['OB 발생: 2타 손실', '해저드 발생: 1타 손실', '벌타 없이 다음 샷을 정상적으로 칠 수 있으면 손실타수에 포함하지 않습니다.'],
    goalsLabel: '허용 손실 상한',
    goals: [{ level: '97타 (+25 오버)', target: '5타 이하' }, { level: '92타 (+20 오버)', target: '3타 이하' }, { level: '87타 (+15 오버)', target: '2타 이하' }],
  },
  페어웨이안착률: {
    title: '페어웨이 안착률',
    description: '티샷이 페어웨이에 안착한 비율입니다. 파3를 제외한 홀에서 계산합니다.',
    criteria: ['페어웨이에 있으면 성공', '러프, 벙커, OB, 해저드 등은 실패', '단, 페어웨이를 놓쳤더라도 다음 샷이 가능하면 스코어상 치명적인 미스는 아닐 수 있습니다.'],
    goalsLabel: '권장 안착률',
    goals: [{ level: '97타 (+25 오버)', target: '40% 이상' }, { level: '92타 (+20 오버)', target: '50% 이상' }, { level: '87타 (+15 오버)', target: '55% 이상' }],
  },
  GIR: {
    title: 'GIR',
    description: '정해진 타수 안에 공을 그린에 올린 홀 수입니다.',
    criteria: ['파3: 1타 안에 온그린', '파4: 2타 안에 온그린', '파5: 3타 안에 온그린'],
    goalsLabel: '권장 달성 홀 수',
    goals: [{ level: '97타 (+25 오버)', target: '3홀 이상' }, { level: '92타 (+20 오버)', target: '4홀 이상' }, { level: '87타 (+15 오버)', target: '6홀 이상' }],
  },
  세컨치명미스: {
    title: '40m 이내 스코어링 구간 진입 실패',
    description: '파4에서는 세컨샷, 파5에서는 서드샷이 기준입니다. 이 샷이 홀 주변 40m 이내, 즉 다음 샷으로 정상적인 어프로치가 가능한 위치까지 갔는지를 봅니다.',
    criteria: ['홀 주변 40m 이내에 도달하면 성공', '40m 밖에 남으면 스코어링 구간 진입 실패', 'OB, 해저드, 나무 뒤, 벙커 턱, 깊은 러프 등 다음 샷이 어려운 위치도 스코어링 구간 진입 실패', '파3는 이 지표에서 제외합니다.'],
    goalsLabel: '허용 실패 상한',
    goals: [{ level: '97타 (+25 오버)', target: '6회 이하' }, { level: '92타 (+20 오버)', target: '4회 이하' }, { level: '87타 (+15 오버)', target: '3회 이하' }],
  },
  웨지온실패: {
    title: '40~100m 웨지 온 성공',
    description: '40m 초과 ~ 100m 미만 거리에서 그린을 노린 웨지샷이 온그린에 성공한 비율입니다.',
    criteria: ['40m 초과 ~ 100m 미만 거리에서 그린에 올리면 성공', '그린을 놓치면 실패', '거리 조절 실패, 짧음, 김, 좌우 미스 모두 실패에 포함합니다.'],
    goalsLabel: '권장 성공률',
    goals: [{ level: '97타 (+25 오버)', target: '30% 이상' }, { level: '92타 (+20 오버)', target: '40% 이상' }, { level: '87타 (+15 오버)', target: '50% 이상' }],
  },
  어프로치성공률: {
    title: '어프로치 성공률',
    description: '40m 이내 그린 주변 어프로치가 홀 근처에 잘 붙은 비율입니다.',
    criteria: ['20m 이내 어프로치: 2m 이내에 붙이면 성공', '20~40m 어프로치: 5m 이내에 붙이면 성공', '기준 거리보다 멀게 남으면 실패', '40m 초과 샷은 웨지 온 지표에서 봅니다.'],
    goalsLabel: '권장 성공률',
    goals: [{ level: '97타 (+25 오버)', target: '30% 이상' }, { level: '92타 (+20 오버)', target: '40% 이상' }, { level: '87타 (+15 오버)', target: '50% 이상' }],
  },
  퍼팅: {
    title: '퍼팅',
    description: '한 라운드에서 그린 위에서 친 전체 퍼팅 수입니다.',
    criteria: ['그린 위에서 친 퍼팅만 계산합니다.', '3퍼팅은 한 홀에서 퍼팅을 3번 이상 한 경우입니다.', '퍼팅 수가 많다면 3퍼팅이 많았는지, 첫 퍼팅 거리가 길었는지도 함께 봐야 합니다.'],
    goalsLabel: '권장 퍼팅 횟수',
    goals: [{ level: '97타 (+25 오버)', target: '40개 이하 / 3퍼팅 6회 이하' }, { level: '92타 (+20 오버)', target: '38개 이하 / 3퍼팅 4회 이하' }, { level: '87타 (+15 오버)', target: '36개 이하 / 3퍼팅 3회 이하' }],
  },
  숏퍼팅성공률: {
    title: '숏퍼팅 성공률',
    description: 'OK를 제외한 2m 이내 퍼트 성공률입니다. 보통 약 1.2~2.0m 퍼트를 기준으로 봅니다.',
    criteria: ['2m 이내 퍼팅을 넣으면 성공', '2m 이내 퍼팅을 놓치면 실패', '특히 1m 이내 퍼팅 실패가 반복되면 별도로 점검이 필요합니다.'],
    goalsLabel: '권장 성공률',
    goals: [{ level: '97타 (+25 오버)', target: '40% 이상' }, { level: '92타 (+20 오버)', target: '50% 이상' }, { level: '87타 (+15 오버)', target: '60% 이상' }],
  },
};

const MISS_BAR_COLORS = ['#E24B4A', '#E24B4A', '#EF9F27', '#EF9F27', '#B4B2A9'];
const PENALTY_MAP: Record<string, number> = { OB: 2, '해저드': 1 };

function secondPenaltyFields(h: Hole): string[] {
  return [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type];
}

function allPenaltyFields(h: Hole): string[] {
  return [h.tee_penalty_type, h.tee2_penalty_type, ...secondPenaltyFields(h)];
}

function countHolesWithPenalty(holes: Hole[], type: string): number {
  return holes.filter(h => allPenaltyFields(h).includes(type)).length;
}

function isGirHole(h: Hole): boolean {
  if (h.par === 3) return h.tee_result === '그린 온(GIR)';
  if (h.par === 4) return h.second1_result === '그린 온(GIR)';
  if (h.par === 5) return h.second2_result === '그린 온(GIR)';
  return false;
}

function hasGirRecorded(h: Hole): boolean {
  if (h.par === 5) return !!(h.second2_result || h.second3_result);
  return !!h.second1_result;
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

function StatCard({ icon, label, value, sub, sub2, unrecorded, onClick, failed }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; sub2?: string; unrecorded?: boolean; onClick?: () => void; failed?: boolean;
}) {
  const valueCls = unrecorded ? 'text-gray-300' : 'text-gray-800';
  const subCls = unrecorded ? 'text-gray-300' : 'text-gray-500';
  return (
    <div
      className={`bg-card rounded-2xl p-3.5 shadow-sm flex flex-col${onClick ? ' cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
      style={{ border: failed ? '1px solid #E24B4A' : '0.5px solid var(--color-border-tertiary)' }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ color: failed ? '#E24B4A' : '#1B4332', background: failed ? '#FCEBEB' : '#f0faf4' }}
        >
          {failed ? <AlertTriangle size={16} /> : icon}
        </div>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
      <p className={`text-xl font-bold leading-none mt-2 mb-2 ${valueCls}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-1 ${subCls}`}>{sub}</p>}
      {sub2 && !unrecorded && <p className={`text-[11px] mt-0.5 ${subCls}`}>{sub2}</p>}
    </div>
  );
}

function MetricInfoModal({ info, onClose }: { info: MetricInfo; onClose: () => void }) {
  return (
<div className="fixed inset-0 z-50 flex items-center justify-center px-4">
  <div className="absolute inset-0 bg-black/40" onClick={onClose} />
  <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[75vh] overflow-y-auto p-5 pb-6">
                <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-800">{info.title}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{info.description}</p>
        <p className="text-xs font-bold text-gray-700 mb-2">판정 기준</p>
        <ul className="text-sm text-gray-600 space-y-1 mb-4">
          {info.criteria.map((c, i) => <li key={i} className="flex gap-2"><span>•</span><span>{c}</span></li>)}
        </ul>
        <p className="text-xs font-bold text-gray-700 mb-2">{info.goalsLabel}</p>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {info.goals.map((g, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
<td className="py-1.5 px-2 text-gray-500 text-xs w-32 whitespace-nowrap">{g.level}</td>
                <td className="py-1.5 px-2 text-gray-700">{g.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    is_detailed: r.is_detailed ?? true,
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
      <div className="relative bg-card rounded-2xl shadow-2xl p-6 pb-10 w-full max-w-[340px] max-h-[75vh] overflow-y-auto">        <h3 className="text-base font-bold text-gray-800 text-center mb-4">라운드 정보 수정</h3>
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">골프장 이름</label>
            <input type="text" value={form.course_name} onChange={e => onChange({ course_name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">기록 방식</label>
            <div className="flex gap-2">
              <button
                onClick={() => onChange({ is_detailed: true })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border ${form.is_detailed !== false ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-500 border-gray-200'}`}
              >상세</button>
              <button
                onClick={() => onChange({ is_detailed: false })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border ${form.is_detailed === false ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-500 border-gray-200'}`}
              >단순</button>
            </div>
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

function SignUpPromptModal({
  onLater,
  onSuccess,
}: {
  onLater: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit() {
    if (!email.trim() || password.length < 6) {
      setError('이메일과 비밀번호(6자 이상)를 입력해 주세요.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signUpWithEmail(email.trim(), password);
    setLoading(false);
    if (!err) {
      onSuccess();
      return;
    }
    setConfirmStep(true);
    setConfirmPassword('');
  }

  async function handleConfirmSignUp() {
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signUpNewUser(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onLater} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-[340px]">
        <h3 className="text-base font-bold text-gray-800 text-center mb-2">데이터를 안전하게 보관하세요</h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-5">
          현재 데이터는 이 기기에만 저장됩니다. 회원가입하면 어디서든 데이터에 접근할 수 있고, 기기를 바꿔도 데이터가 유지됩니다.
        </p>

        <div className="space-y-3 mb-4">
          {confirmStep ? (
            <>
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                <span className="font-medium text-gray-800">{email}</span>
                <br />
                이 이메일로 회원가입을 진행할까요?
              </p>
              <input
                type="password"
                placeholder="비밀번호 (6자 이상)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
              />
              <input
                type="password"
                placeholder="비밀번호 확인"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
              />
              <button
                onClick={handleConfirmSignUp}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {loading ? '처리 중...' : '회원가입'}
              </button>
              <button
                onClick={() => { setConfirmStep(false); setConfirmPassword(''); setError(''); }}
                className="w-full py-2 text-sm text-gray-500"
              >
                뒤로
              </button>
            </>
          ) : (
            <>
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
              />
              <input
                type="password"
                placeholder="비밀번호 (6자 이상)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
              />
              <button
                onClick={handleEmailSubmit}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {loading ? '처리 중...' : '로그인 / 회원가입'}
              </button>
            </>
          )}
        </div>

        {error && <p className="text-red-500 text-xs text-center mb-3">{error}</p>}

        <button
          onClick={onLater}
          className="w-full py-2.5 text-sm text-gray-400 font-medium active:opacity-70"
        >
          나중에 하기
        </button>
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

export default function RoundSummary({ round, viewMode, shareMode = false, holes: externalHoles, onSave, onDelete, onMissBreakdown, onViewHoles }: Props) {
  const [roundData, setRoundData] = useState<Round>(round);
  const [memo, setMemo] = useState<string>(round.memo ?? '');
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoInput, setMemoInput] = useState('');
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(() => roundToEditForm(round));
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  useEffect(() => {
    if (shareMode) return;
    isAnonymousUser().then(anon => {
      if (anon) setShowSignUpPrompt(true);
    });
  }, [shareMode]);
  const [activeSegment, setActiveSegment] = useState<SegmentType>('tee');
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [chartRounds, setChartRounds] = useState<{ round: Round; holes: Hole[] }[]>([]);

  useEffect(() => {
    setRoundData(round);
    setMemo(round.memo ?? '');
    setMemoEditing(false);
  }, [round]);

  useEffect(() => {
    if (shareMode) return;
    async function fetchChartRounds() {
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .order('date', { ascending: false })
        .limit(6);

      if (!rounds?.length) {
        setChartRounds([]);
        return;
      }

      const { data: allHoles } = await supabase
        .from('holes')
        .select('*')
        .in('round_id', rounds.map(r => r.id));

      const holesMap: Record<string, Hole[]> = {};
      for (const h of allHoles ?? []) {
        const hole = h as Hole;
        if (!holesMap[hole.round_id]) holesMap[hole.round_id] = [];
        holesMap[hole.round_id].push(hole);
      }

      const combined = rounds.map(r => ({
        round: r as Round,
        holes: (holesMap[r.id] ?? []).sort((a, b) => a.hole_number - b.hole_number),
      }));

      setChartRounds([...combined].filter(d => d.round.is_detailed !== false).reverse());
    }
    fetchChartRounds();
  }, [shareMode]);

  useEffect(() => {
    if (externalHoles) {
      setHoles(externalHoles);
      setLoading(false);
      return;
    }
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
  }, [roundData.id, externalHoles]);

  const totalStrokes = holes.reduce((s, h) => s + h.total_strokes, 0);
  const goalTier = totalStrokes >= 97 ? 0 : totalStrokes >= 92 ? 1 : 2;
  const goalPenalty = [5, 3, 2][goalTier];
  const goalFairway = [40, 50, 55][goalTier];
  const goalGir = [3, 4, 6][goalTier];
  const goalFatalMiss = [6, 4, 3][goalTier];
  const goalWedge = [30, 40, 50][goalTier];
  const goalApproach = [30, 40, 50][goalTier];
  const goalTotalPutts = [40, 38, 36][goalTier];
  const goalThreePutt = [6, 4, 3][goalTier];
  const goalShortPutt = [40, 50, 60][goalTier];
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

  const fairwayDenom = 14;
  const fairwayHits = holes.filter(h => h.par !== 3 && h.tee_result === '페어웨이').length;
  const fairwayPct = Math.round((fairwayHits / fairwayDenom) * 100);

  const girCount = holes.filter(isGirHole).length;
  const par3Gir = holes.filter(h => h.par === 3 && h.tee_result === '그린 온(GIR)').length;
  const par4Gir = holes.filter(h => h.par === 4 && h.second1_result === '그린 온(GIR)').length;
  const par5Gir = holes.filter(h => h.par === 5 && h.second2_result === '그린 온(GIR)').length;

  const approachSuccess = holes.reduce((sum, h) => {
    let count = 0;
    if (h.approach1_result === '성공') count++;
    if (h.approach2_result === '성공') count++;
    if (h.approach3_result === '성공') count++;
    return sum + count;
  }, 0);
  const approachAttempts = holes.reduce((sum, h) => {
    let count = 0;
    if (h.approach1_result) count++;
    if (h.approach2_result) count++;
    if (h.approach3_result) count++;
    return sum + count;
  }, 0);
  const approachPct = approachAttempts > 0
    ? Math.round((approachSuccess / approachAttempts) * 100)
    : 0;


  const fatalMissCount = holes.reduce((sum, h) => {
    let count = 0;
    for (const p of [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      if (p === '어프로치 불가' || p === 'OB' || p === '해저드') count++;
    }
    return sum + count;
  }, 0);

  const fatalOB = holes.reduce((sum, h) => {
    let count = 0;
    for (const p of [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      if (p === 'OB') count++;
    }
    return sum + count;
  }, 0);

  const fatalHazard = holes.reduce((sum, h) => {
    let count = 0;
    for (const p of [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type]) {
      if (p === '해저드') count++;
    }
    return sum + count;
  }, 0);

  const fatalApproachNG = fatalMissCount - fatalOB - fatalHazard;

const wedgeTotal = holes.reduce((sum, h) => {
    const clubs = [h.second1_club, h.second2_club, h.second3_club, h.second4_club];
    return sum + clubs.filter(c => c?.includes('웨지')).length;
  }, 0);

  const wedgeSuccess = holes.reduce((sum, h) => {
    const clubs = [h.second1_club, h.second2_club, h.second3_club, h.second4_club];
    const results = [h.second1_result, h.second2_result, h.second3_result, h.second4_result];
    return sum + clubs.filter((c, i) => c?.includes('웨지') && results[i] === '그린 온(GIR)').length;
  }, 0);
  const wedgeSuccessRate = wedgeTotal > 0 ? Math.round((wedgeSuccess / wedgeTotal) * 100) : null;

  const puttMissHoles = holes.filter(h => h.putt_miss);
  const shortPuttSuccess = puttMissHoles.filter(h => h.putt_miss === '숏퍼팅 성공').length;
  const shortPuttPct = puttMissHoles.length > 0
    ? Math.round((shortPuttSuccess / puttMissHoles.length) * 100)
    : 0;

  const obHoles = countHolesWithPenalty(holes, 'OB');
  const hazardHoles = countHolesWithPenalty(holes, '해저드');
  const teeOB = holes.filter(h => [h.tee_penalty_type, h.tee2_penalty_type].includes('OB')).length;
  const teeHZ = holes.filter(h => [h.tee_penalty_type, h.tee2_penalty_type].includes('해저드')).length;
  const secondOB = holes.filter(h => [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type].includes('OB')).length;
  const secondHZ = holes.filter(h => [h.second1_penalty_type, h.second2_penalty_type, h.second3_penalty_type].includes('해저드')).length;

  const fairwayRecorded = holes.filter(h => h.par !== 3 && h.tee_result).length;
  const girRecorded = holes.filter(hasGirRecorded).length;
  const fatalRecorded = holes.filter(h =>
    !!(h.second1_result || h.second2_result || h.second3_result),
  ).length;
  const wedgeRecorded = holes.filter(h =>
    [h.second1_club, h.second2_club, h.second3_club].some(c => c?.includes('웨지')),
  ).length;
  const approachRecorded = holes.filter(h => h.approach1_club).length;
  const shortPuttRecorded = holes.filter(h => h.putt_miss).length;
  const penaltiesRecorded = holes.length > 0;

  const segFairwayPct = fairwayPct;
  const segSecondGir = holes.filter(isGirHole).length;
  const approach20Success = holes.filter(h => h.approach1_club === '20m이내' && h.approach1_result === '성공').length;
  const approach20Total = holes.filter(h => h.approach1_club === '20m이내').length;
  const approach2040Success = holes.filter(h => h.approach1_club === '20~40m' && h.approach1_result === '성공').length;
  const approach2040Total = holes.filter(h => h.approach1_club === '20~40m').length;
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

  const chart6Penalty = chartRounds.map(d => ({
    value: computeRoundPenaltyStrokes(d.holes),
    date: d.round.date,
  }));
  const chart6CriticalMiss = chartRounds.map(d => ({
    value: computeRoundFatalMissCount(d.holes),
    date: d.round.date,
  }));
  const chart6ApproachSuccess = chartRounds.map(d => ({
    value: computeRoundApproachTrendPct(d.holes),
    date: d.round.date,
  }));
  const chart6ShortPuttMiss = chartRounds.map(d => ({
    value: computeRoundShortPuttMissCount(d.holes),
    date: d.round.date,
  }));
  const chart6TeePenalty = chartRounds.map(d => ({ value: computeTeePenaltyStrokes(d.holes), date: d.round.date }));
  const chart6Fairway = chartRounds.map(d => ({ value: computeFairwayPct(d.holes), date: d.round.date }));
  const chart6Gir = chartRounds.map(d => ({ value: computeGirCount(d.holes), date: d.round.date }));
  const chart6WedgeSuccess = chartRounds.map(d => ({ value: computeWedgeSuccessRate(d.holes), date: d.round.date }));
  const chart6Approach20 = chartRounds.map(d => ({ value: computeApproach20Pct(d.holes), date: d.round.date }));
  const chart6Approach2040 = chartRounds.map(d => ({ value: computeApproach2040Pct(d.holes), date: d.round.date }));
  const chart6TotalPutts = chartRounds.map(d => ({ value: computeTotalPutts(d.holes), date: d.round.date }));
  const chart6ThreePutt = chartRounds.map(d => ({ value: computeThreePuttCount(d.holes), date: d.round.date }));
  const chart6ShortPuttSuccess = chartRounds.map(d => ({ value: computeShortPuttSuccessRate(d.holes), date: d.round.date }));
  const avgChartPenalty = chartPointsAvg(chart6Penalty);
  const avgChartCriticalMiss = chartPointsAvg(chart6CriticalMiss);
  const avgChartApproachSuccess = chartPointsAvg(chart6ApproachSuccess);
  const avgChartShortPuttMiss = chartPointsAvg(chart6ShortPuttMiss);
  const avgChart6TeePenalty = chartPointsAvg(chart6TeePenalty);
  const avgChart6Fairway = chartPointsAvg(chart6Fairway);
  const avgChart6Gir = chartPointsAvg(chart6Gir);
  const avgChart6WedgeSuccess = chartPointsAvg(chart6WedgeSuccess);
  const avgChart6Approach20 = chartPointsAvg(chart6Approach20);
  const avgChart6Approach2040 = chartPointsAvg(chart6Approach2040);
  const avgChart6TotalPutts = chartPointsAvg(chart6TotalPutts);
  const avgChart6ThreePutt = chartPointsAvg(chart6ThreePutt);
  const avgChart6ShortPuttSuccess = chartPointsAvg(chart6ShortPuttSuccess);

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 200));
    setSaving(false);
    if (await isAnonymousUser()) {
      setShowSignUpPrompt(true);
      return;
    }
    onSave?.();
  }

  function handleSignUpLater() {
    setShowSignUpPrompt(false);
  }
  
  async function handleDelete() {
    setDeleting(true);
    await onDelete?.();
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
      is_detailed: editForm.is_detailed,
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

  async function saveMemo(text: string) {
    const trimmed = text.trim();
    await supabase.from('rounds').update({ memo: trimmed }).eq('id', roundData.id);
    setMemo(trimmed);
    setRoundData({ ...roundData, memo: trimmed });
    setMemoEditing(false);
  }

  async function deleteMemo() {
    await supabase.from('rounds').update({ memo: '' }).eq('id', roundData.id);
    setMemo('');
    setRoundData({ ...roundData, memo: '' });
    setMemoEditing(false);
  }

  async function handleShare() {
    await supabase.from('rounds').update({ is_public: true }).eq('id', roundData.id);
    const shareUrl = `${window.location.origin}?share=${roundData.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    } catch {
      if (navigator.share) {
        await navigator.share({ title: roundData.course_name, url: shareUrl });
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
        return;
      }
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  }

  const metricClick = (key: string) => () => setActiveMetric(key);

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

      {activeMetric && METRIC_INFO[activeMetric] && (
        <MetricInfoModal info={METRIC_INFO[activeMetric]} onClose={() => setActiveMetric(null)} />
      )}

      {showSignUpPrompt && !shareMode && (
        <SignUpPromptModal onLater={handleSignUpLater} onSuccess={handleSignUpLater} />
      )}

      {shareToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          링크가 복사되었습니다
        </div>
      )}

      <div className="h-screen bg-surface flex flex-col overflow-hidden">
      {shareMode && (
        <div className="bg-gray-50 border-b border-gray-200 py-2 text-center">
          <p className="text-xs text-gray-400">📋 공유된 라운드 기록입니다</p>
        </div>
      )}
      <div className="bg-[#1B4332] text-white px-4 pb-4" style={{ paddingTop: shareMode ? '1rem' : 'calc(env(safe-area-inset-top) + 1rem)' }}>
          <p className="text-green-200 text-xs mb-1">{roundData.date}  · {roundData.time}</p>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold flex-1 flex items-center gap-2">
              {roundData.course_name}
              {!shareMode && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="p-1 active:opacity-70 transition-opacity"
                  aria-label="라운드 정보 수정"
                >
                  <Pencil size={14} className="text-green-300" />
                </button>
              )}
            </h2>
            {!shareMode && (
              <button
                type="button"
                onClick={handleShare}
                className="p-2 active:opacity-70 transition-opacity flex-shrink-0"
                aria-label="라운드 공유"
              >
                <Share2 size={18} className="text-green-300" />
              </button>
            )}
          </div>
          {!shareMode && (roundData.companion1 || roundData.companion2 || roundData.companion3) && (
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
            </>
          )}
        </div>

        <div className={`px-4 py-5 space-y-5 overflow-y-auto flex-1 ${shareMode ? 'pb-8' : 'pb-28'}`}>
          {holes.length > 0 && (
            <>
              <div className="flex gap-3 px-0">
                <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">전반 {roundData.course_front ? `(${roundData.course_front})` : '(1-9홀)'}</p>
                  <p className="text-gray-800 font-bold text-xl">{front9Score}</p>
                  <p className="text-gray-500 text-sm">{f9Sign}</p>
                </div>
                <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">후반 {roundData.course_back ? `(${roundData.course_back})` : '(10-18홀)'}</p>
                  <p className="text-gray-800 font-bold text-xl">{back9Score}</p>
                  <p className="text-gray-500 text-sm">{b9Sign}</p>
                </div>
              </div>
              {!shareMode && (
              <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4">
                {memoEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={memoInput}
                      onChange={e => setMemoInput(e.target.value)}
                      placeholder="라운드 메모를 입력하세요"
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 focus:border-[#1B4332]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveMemo(memoInput)}
                        className="flex-1 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold active:scale-95 transition-transform"
                      >
                        저장
                      </button>
                      {memo && (
                        <button
                          onClick={deleteMemo}
                          className="px-4 py-2.5 rounded-xl text-red-400 text-sm font-semibold active:scale-95 transition-transform"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                ) : memo ? (
                  <div className="relative">
                    <button
                      onClick={() => { setMemoInput(memo); setMemoEditing(true); }}
                      className="absolute top-0 right-0 p-1 text-gray-400 active:scale-95 transition-transform"
                    >
                      <Pencil size={16} />
                    </button>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap pr-8">{memo}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => { setMemoInput(''); setMemoEditing(true); }}
                    className="w-full text-sm text-gray-500 text-left active:opacity-70"
                  >
                    + 라운드 메모 추가
                  </button>
                )}
              </div>
              )}

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

              {roundData.is_detailed !== false && (
              <>
              {(() => {
                const teeSubParts = [teeOB > 0 ? `OB ${teeOB}회` : '', teeHZ > 0 ? `HZ ${teeHZ}회` : ''].filter(Boolean).join(' · ');
                const secondSubParts = [secondOB > 0 ? `OB ${secondOB}회` : '', secondHZ > 0 ? `HZ ${secondHZ}회` : ''].filter(Boolean).join(' · ');
                const girParts = [par3Gir > 0 ? `파3 ${par3Gir}홀` : '', par4Gir > 0 ? `파4 ${par4Gir}홀` : '', par5Gir > 0 ? `파5 ${par5Gir}홀` : ''].filter(Boolean);
                return (
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<TicketX size={16} />} label="손실 타수" value={`${penalties}타`} sub={teeSubParts ? `티샷 (${teeSubParts})` : '티샷 없음'} sub2={secondSubParts ? `세컨샷 (${secondSubParts})` : undefined} unrecorded={!penaltiesRecorded} failed={holes.length > 0 && penalties > goalPenalty} onClick={metricClick('손실타수')} />
                <StatCard
                  icon={<Flag size={16} />}
                  label="페어웨이 안착률"
                  unrecorded={fairwayRecorded === 0}
                  value={fairwayRecorded === 0 ? '–' : `${fairwayPct}%`}
                  sub={fairwayRecorded === 0 ? '미기록' : `${fairwayHits} / ${fairwayDenom}홀 안착`}
                  failed={!!fairwayRecorded && fairwayPct < goalFairway}
                  onClick={metricClick('페어웨이안착률')}
                />
                <StatCard
                  icon={<Route size={16} />}
                  label="GIR"
                  unrecorded={girRecorded === 0}
                  value={girRecorded === 0 ? '–' : `${girCount}홀`}
                  sub={girRecorded === 0 ? '미기록' : girParts.length === 0 ? '온그린 없음' : girParts.length === 3 ? girParts.slice(0, 2).join(' · ') : girParts.join(' · ')}
                  sub2={girRecorded === 0 ? undefined : girParts.length === 3 ? girParts[2] : undefined}
                  failed={!!girRecorded && girCount < goalGir}
                  onClick={metricClick('GIR')}
                />
                <StatCard
                  icon={<PlayOff size={16} />}
                  label="어프로치권 실패"
                  unrecorded={fatalRecorded === 0}
                  value={fatalRecorded === 0 ? '–' : `${fatalMissCount}회`}
                  sub={fatalRecorded === 0 ? '미기록' : `어프로치불가 ${fatalApproachNG}회`}
                  sub2={fatalRecorded === 0 ? undefined : [fatalOB > 0 ? `OB ${fatalOB}회` : '', fatalHazard > 0 ? `해저드 ${fatalHazard}회` : ''].filter(Boolean).join(' · ') || undefined}
                  failed={!!fatalRecorded && fatalMissCount > goalFatalMiss}
                  onClick={metricClick('세컨치명미스')}
                />
                <StatCard
                  icon={<Zap size={16} />}
                  label="웨지온 성공률"
                  unrecorded={wedgeRecorded === 0}
                  value={wedgeRecorded === 0 ? '–' : wedgeSuccessRate !== null ? `${wedgeSuccessRate}%` : '–'}
                  sub={wedgeRecorded === 0 ? '미기록' : `${wedgeSuccess} / ${wedgeTotal}회 온그린`}
                  failed={!!wedgeRecorded && (wedgeSuccessRate ?? 0) < goalWedge}
                  onClick={metricClick('웨지온실패')}
                />
                <StatCard
                  icon={<MapPinCheck size={16} />}
                  label="어프로치 성공률"
                  unrecorded={approachRecorded === 0}
                  value={approachRecorded === 0 ? '–' : `${approachPct}%`}
                  sub={approachRecorded === 0 ? '미기록' : `20m이내 ${approach20Total > 0 ? Math.round((approach20Success / approach20Total) * 100) : '–'}%`}
                  sub2={approachRecorded === 0 ? undefined : `20~40m ${approach2040Total > 0 ? Math.round((approach2040Success / approach2040Total) * 100) : '–'}%`}
                  failed={!!approachRecorded && approachPct < goalApproach}
                  onClick={metricClick('어프로치성공률')}
                />
                <StatCard icon={<Disc size={16} />} label="퍼팅" value={`총 ${totalPutts}개`} sub={`3퍼팅 이상 ${threePuttPlus}홀`} failed={holes.length > 0 && (totalPutts > goalTotalPutts || threePuttPlus > goalThreePutt)} onClick={metricClick('퍼팅')} />
                <StatCard
                  icon={<Trophy size={16} />}
                  label="숏퍼팅 성공률"
                  unrecorded={shortPuttRecorded === 0}
                  value={shortPuttRecorded === 0 ? '–' : `${shortPuttPct}%`}
                  sub={shortPuttRecorded === 0 ? '미기록' : `${shortPuttSuccess} / ${puttMissHoles.length}회 성공`}
                  failed={!!shortPuttRecorded && shortPuttPct < goalShortPutt}
                  onClick={metricClick('숏퍼팅성공률')}
                />
              </div>
                );
              })()}

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
                    <p className="text-xs font-semibold text-gray-500 mb-2">티샷 손실타수</p>
                    <SegmentLineChart
                      points={chart6TeePenalty}
                      lineColor="#E24B4A"
                      avgValue={avgChart6TeePenalty}
                      caption="티샷 손실타수 추이 · 최근 6라운드 (낮을수록 좋음)"
                      formatValue={v => `${v}타`}
                      yMin={0}
                    />
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">페어웨이 안착률</p>
                      <SegmentLineChart
                        points={chart6Fairway}
                        lineColor="#1D9E75"
                        avgValue={avgChart6Fairway}
                        caption="페어웨이 안착률 추이 · 최근 6라운드 (높을수록 좋음)"
                        formatValue={v => `${v}%`}
                        yMin={0}
                        yMax={100}
                      />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                    <RankedMissBarChart items={teeMissBars} />
                    <SegmentCardFootnote>
                      * 티샷 손실타수는 OB 1회 = 2타, 해저드 1회 = 1타로 계산합니다
                    </SegmentCardFootnote>
                  </div>
                )}

                {activeSegment === 'second' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">세컨샷</h3>
                    <p className="text-xs font-semibold text-gray-500 mb-2">GIR</p>
                    <SegmentLineChart
                      points={chart6Gir}
                      lineColor="#1D9E75"
                      avgValue={avgChart6Gir}
                      caption="GIR 추이 · 최근 6라운드 (높을수록 좋음)"
                      formatValue={v => `${v}홀`}
                      yMin={0}
                    />
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">스코어링 구간 진입 실패</p>
                      <SegmentLineChart
                        points={chart6CriticalMiss}
                        lineColor="#E24B4A"
                        avgValue={avgChartCriticalMiss}
                        caption="스코어링 구간 진입 실패 추이 · 최근 6라운드 (낮을수록 좋음)"
                        formatValue={v => `${v}회`}
                        yMin={0}
                      />
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">웨지온 성공률</p>
                      <SegmentLineChart
                        points={chart6WedgeSuccess}
                        lineColor="#F59E0B"
                        avgValue={avgChart6WedgeSuccess}
                        caption="웨지온 성공률 추이 · 최근 6라운드 (높을수록 좋음)"
                        formatValue={v => `${v}%`}
                        yMin={0}
                        yMax={100}
                      />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                    <RankedMissBarChart items={secondMissBars} />
                    <SegmentCardFootnote>
                      * 스코어링 구간 진입 실패: 세컨샷 후 40m 이내의 어프로치 불가 또는 OB, 해저드로 이어진 경우
                    </SegmentCardFootnote>
                  </div>
                )}

                {activeSegment === 'approach' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">어프로치</h3>
                    <p className="text-xs font-semibold text-gray-500 mb-2">20m이내 2m안착 성공률</p>
                    <SegmentLineChart
                        points={chart6Approach20}
                      lineColor="#1D9E75"
                      avgValue={avgChart6Approach20}
                      caption="20m이내 2m안착 성공률 추이 · 최근 6라운드 (높을수록 좋음)"
                      formatValue={v => `${v}%`}
                      yMin={0}
                      yMax={100}
                    />
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">20~40m 5m안착 성공률</p>
                      <SegmentLineChart
                        points={chart6Approach2040}
                        lineColor="#F59E0B"
                        avgValue={avgChart6Approach2040}
                        caption="20~40m 5m안착 성공률 추이 · 최근 6라운드 (높을수록 좋음)"
                        formatValue={v => `${v}%`}
                        yMin={0}
                        yMax={100}
                      />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                    <RankedMissBarChart items={approachMissBars} />
                  </div>
                )}

                {activeSegment === 'putt' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">퍼팅</h3>
                    <p className="text-xs font-semibold text-gray-500 mb-2">홀별 퍼팅 분포</p>
                    <ColoredBarChart
                      items={[
                        { label: '1퍼팅', avg: putt1, color: '#1D9E75' },
                        { label: '2퍼팅', avg: putt2, color: '#378ADD' },
                        { label: '3퍼팅', avg: putt3, color: '#EF9F27' },
                        { label: '4퍼팅+', avg: putt4plus, color: '#E24B4A' },
                      ]}
                    />
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">총 퍼팅 수</p>
                      <SegmentLineChart
                        points={chart6TotalPutts}
                        lineColor="#3B82F6"
                        avgValue={avgChart6TotalPutts}
                        caption="총 퍼팅 수 추이 · 최근 6라운드 (낮을수록 좋음)"
                        formatValue={v => `${v}개`}
                        yMin={0}
                      />
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">3퍼팅 이상 홀 수</p>
                      <SegmentLineChart
                        points={chart6ThreePutt}
                        lineColor="#E24B4A"
                        avgValue={avgChart6ThreePutt}
                        caption="3퍼팅 이상 홀 수 추이 · 최근 6라운드 (낮을수록 좋음)"
                        formatValue={v => `${v}홀`}
                        yMin={0}
                      />
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">숏퍼팅 성공률</p>
                      <SegmentLineChart
                        points={chart6ShortPuttSuccess}
                        lineColor="#1D9E75"
                        avgValue={avgChart6ShortPuttSuccess}
                        caption="숏퍼팅 성공률 추이 · 최근 6라운드 (높을수록 좋음)"
                        formatValue={v => `${v}%`}
                        yMin={0}
                        yMax={100}
                      />
                    </div>
                    <SegmentCardFootnote>* 숏퍼팅: 2m 이내 홀인 퍼팅</SegmentCardFootnote>
                  </div>
                )}

              </div>
              </>
              )}

              <button onClick={() => onMissBreakdown?.()}
                className="w-full bg-white border-2 border-[#1B4332]/30 text-[#1B4332] py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <BarChart2 size={16} />
                미스 유형 집계 보기
                <ChevronRight size={14} />
              </button>

              <button onClick={() => onViewHoles?.()}
                className="w-full bg-white border-2 border-[#1B4332]/30 text-[#1B4332] py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <List size={16} />
                각 홀 기록 보기
                <ChevronRight size={14} />
              </button>
            </>
          )}

          {!shareMode && (viewMode === 'recording' ? (
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
          ))}
        </div>
      </div>
    </>
  );
}
