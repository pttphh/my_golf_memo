import { useState, useEffect } from 'react';
import { Trophy, Target, AlertTriangle, BarChart2, ChevronRight, List, Trash2, Flag, Pencil, Crosshair, Disc, CheckCircle } from 'lucide-react';
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
  chartPointsAvg,
} from '../components/SegmentChart';

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

type MetricInfo = {
  title: string;
  description: string;
  criteria: string[];
  goals: { level: string; target: string }[];
};

const METRIC_INFO: Record<string, MetricInfo> = {
  손실타수: {
    title: '손실 타수',
    description: 'OB, 해저드처럼 공을 잃거나 벌타를 받은 상황에서 잃은 타수입니다. 이 앱에서는 OB 1회 = 2타 손실, 해저드 1회 = 1타 손실로 계산합니다.',
    criteria: ['OB 발생: 2타 손실', '해저드 발생: 1타 손실', '벌타 없이 다음 샷을 정상적으로 칠 수 있으면 손실타수에 포함하지 않습니다.'],
    goals: [{ level: '100타대', target: '6타 이하' }, { level: '90타대', target: '4타 이하' }, { level: '80타대', target: '2타 이하' }],
  },
  페어웨이안착률: {
    title: '페어웨이 안착률',
    description: '티샷이 페어웨이에 안착한 비율입니다. 파3를 제외한 홀에서 계산합니다.',
    criteria: ['페어웨이에 있으면 성공', '러프, 벙커, OB, 해저드 등은 실패', '단, 페어웨이를 놓쳤더라도 다음 샷이 가능하면 스코어상 치명적인 미스는 아닐 수 있습니다.'],
    goals: [{ level: '100타대', target: '40% 이상' }, { level: '90타대', target: '50% 이상' }, { level: '80타대', target: '60% 이상' }],
  },
  GIR: {
    title: 'GIR',
    description: '정해진 타수 안에 공을 그린에 올린 비율입니다. GIR은 "그린 적중률"로 볼 수 있습니다.',
    criteria: ['파3: 1타 안에 온그린', '파4: 2타 안에 온그린', '파5: 3타 안에 온그린'],
    goals: [{ level: '100타대', target: '10~20%' }, { level: '90타대', target: '20~35%' }, { level: '80타대', target: '40% 이상' }],
  },
  세컨치명미스: {
    title: '세컨 치명미스',
    description: '파4에서는 세컨샷, 파5에서는 서드샷이 기준입니다. 이 샷이 홀 주변 40m 이내, 즉 다음 샷으로 정상적인 어프로치가 가능한 위치까지 갔는지를 봅니다.',
    criteria: ['홀 주변 40m 이내에 도달하면 성공', '40m 밖에 남으면 치명미스', 'OB, 해저드, 나무 뒤, 벙커 턱, 깊은 러프 등 다음 샷이 어려운 위치도 치명미스', '파3는 이 지표에서 제외합니다.'],
    goals: [{ level: '100타대', target: '6회 이하' }, { level: '90타대', target: '4회 이하' }, { level: '80타대', target: '2회 이하' }],
  },
  웨지온실패: {
    title: '웨지 온 실패',
    description: '40m 초과 ~ 100m 미만 거리에서 그린을 노린 웨지샷이 온그린에 실패한 경우입니다.',
    criteria: ['40m 초과 ~ 100m 미만 거리에서 그린에 올리면 성공', '같은 거리에서 그린을 놓치면 웨지 온 실패', '거리 조절 실패, 짧음, 김, 좌우 미스 모두 온그린 실패에 포함합니다.'],
    goals: [{ level: '100타대', target: '4회 이하' }, { level: '90타대', target: '3회 이하' }, { level: '80타대', target: '1~2회 이하' }],
  },
  어프로치성공률: {
    title: '어프로치 성공률',
    description: '40m 이내 그린 주변 어프로치가 홀 근처에 잘 붙은 비율입니다.',
    criteria: ['20m 이내 어프로치: 3m 이내에 붙이면 성공', '20~40m 어프로치: 5m 이내에 붙이면 성공', '기준 거리보다 멀게 남으면 실패', '40m 초과 샷은 웨지 온 실패 지표에서 봅니다.'],
    goals: [{ level: '100타대', target: '40% 이상' }, { level: '90타대', target: '50% 이상' }, { level: '80타대', target: '60% 이상' }],
  },
  퍼팅: {
    title: '퍼팅',
    description: '한 라운드에서 그린 위에서 친 전체 퍼팅 수입니다.',
    criteria: ['그린 위에서 친 퍼팅만 계산합니다.', '3퍼팅은 한 홀에서 퍼팅을 3번 이상 한 경우입니다.', '퍼팅 수가 많다면 3퍼팅이 많았는지, 첫 퍼팅 거리가 길었는지도 함께 봐야 합니다.'],
    goals: [{ level: '100타대', target: '37개 이하 / 3퍼팅 4회 이하' }, { level: '90타대', target: '35~36개 이하 / 3퍼팅 3회 이하' }, { level: '80타대', target: '33~34개 이하 / 3퍼팅 2회 이하' }, { level: '싱글 수준', target: '32개 이하 / 3퍼팅 1회 이하' }],
  },
  숏퍼팅성공률: {
    title: '숏퍼팅 성공률',
    description: '2m 이내의 짧은 퍼팅을 성공한 비율입니다.',
    criteria: ['2m 이내 퍼팅을 넣으면 성공', '2m 이내 퍼팅을 놓치면 실패', '특히 1m 이내 퍼팅 실패가 반복되면 별도로 점검이 필요합니다.'],
    goals: [{ level: '100타대', target: '60% 이상' }, { level: '90타대', target: '70% 이상' }, { level: '80타대', target: '80% 이상' }],
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

function StatCard({ icon, label, value, sub, sub2, unrecorded, onClick }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; sub2?: string; unrecorded?: boolean; onClick?: () => void;
}) {
  const valueCls = unrecorded ? 'text-gray-300' : 'text-gray-800';
  const subCls = unrecorded ? 'text-gray-300' : 'text-gray-500';
  return (
    <div
      className={`bg-card rounded-2xl p-3.5 border border-gray-100 shadow-sm flex flex-col gap-2${onClick ? ' cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-[#1B4332] flex-shrink-0">
          {icon}
        </div>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
      <p className={`text-xl font-bold leading-none ${valueCls}`}>{value}</p>
      {sub && <p className={`text-[11px] ${subCls}`}>{sub}</p>}
      {sub2 && !unrecorded && <p className={`text-[11px] ${subCls}`}>{sub2}</p>}
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
        <p className="text-xs font-bold text-gray-700 mb-2">목표</p>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {info.goals.map((g, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="py-1.5 px-2 text-gray-500 text-xs w-24">{g.level}</td>
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

export default function RoundSummary({ round, viewMode, onSave, onDelete, onMissBreakdown, onViewHoles }: Props) {
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
  useEffect(() => {
    isAnonymousUser().then(anon => {
      if (anon) setShowSignUpPrompt(true);
    });
  }, []);
  const [activeSegment, setActiveSegment] = useState<SegmentType>('tee');
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [chartRounds, setChartRounds] = useState<{ round: Round; holes: Hole[] }[]>([]);

  useEffect(() => {
    setRoundData(round);
    setMemo(round.memo ?? '');
    setMemoEditing(false);
  }, [round]);

  useEffect(() => {
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

      setChartRounds([...combined].reverse());
    }
    fetchChartRounds();
  }, []);

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

  const fairwayDenom = 14;
  const fairwayHits = holes.filter(h => h.par !== 3 && h.tee_result === '페어웨이').length;
  const fairwayPct = Math.round((fairwayHits / fairwayDenom) * 100);

  const girCount = holes.filter(isGirHole).length;
  const girPct = Math.round((girCount / 18) * 100);

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

  const wedgeTotal = holes.filter(h =>
    [h.second1_club, h.second2_club, h.second3_club].some(c => c?.includes('웨지')),
  ).length;

  const wedgeMiss = holes.filter(h =>
    [h.second1_club, h.second2_club, h.second3_club].some((c, i) => {
      const results = [h.second1_result, h.second2_result, h.second3_result];
      return c?.includes('웨지') && results[i] === '그린 미스';
    }),
  ).length;

  const puttMissHoles = holes.filter(h => h.putt_miss);
  const shortPuttSuccess = puttMissHoles.filter(h => h.putt_miss === '숏퍼팅 성공').length;
  const shortPuttPct = puttMissHoles.length > 0
    ? Math.round((shortPuttSuccess / puttMissHoles.length) * 100)
    : 0;

  const obHoles = countHolesWithPenalty(holes, 'OB');
  const hazardHoles = countHolesWithPenalty(holes, '해저드');

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
  const avgChartPenalty = chartPointsAvg(chart6Penalty);
  const avgChartCriticalMiss = chartPointsAvg(chart6CriticalMiss);
  const avgChartApproachSuccess = chartPointsAvg(chart6ApproachSuccess);
  const avgChartShortPuttMiss = chartPointsAvg(chart6ShortPuttMiss);

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 200));
    setSaving(false);
    if (await isAnonymousUser()) {
      setShowSignUpPrompt(true);
      return;
    }
    onSave();
  }

  function handleSignUpLater() {
    setShowSignUpPrompt(false);
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

      {showSignUpPrompt && (
        <SignUpPromptModal onLater={handleSignUpLater} onSuccess={handleSignUpLater} />
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
                <StatCard icon={<AlertTriangle size={16} />} label="손실 타수" value={`${penalties}타`} sub={`OB ${obHoles}홀 · 해저드 ${hazardHoles}홀`} onClick={() => setActiveMetric('손실타수')} />
                <StatCard
                  icon={<Flag size={16} />}
                  label="페어웨이 안착률"
                  unrecorded={fairwayRecorded === 0}
                  value={fairwayRecorded === 0 ? '–' : `${fairwayPct}%`}
                  sub={fairwayRecorded === 0 ? '미기록' : `${fairwayHits} / ${fairwayDenom}`}
                  onClick={() => setActiveMetric('페어웨이안착률')}
                />
                <StatCard
                  icon={<Trophy size={16} />}
                  label="GIR"
                  unrecorded={girRecorded === 0}
                  value={girRecorded === 0 ? '–' : `${girPct}%`}
                  sub={girRecorded === 0 ? '미기록' : `${girCount} / 18`}
                  onClick={() => setActiveMetric('GIR')}
                />
                <StatCard
                  icon={<AlertTriangle size={16} />}
                  label="세컨샷 치명미스"
                  unrecorded={fatalRecorded === 0}
                  value={fatalRecorded === 0 ? '–' : `${fatalMissCount}회`}
                  sub={fatalRecorded === 0 ? '미기록' : `OB ${fatalOB} · 해저드 ${fatalHazard}`}
                  sub2={fatalRecorded === 0 ? undefined : `어프로치불가 ${fatalApproachNG}`}
                  onClick={() => setActiveMetric('세컨치명미스')}
                />
                <StatCard
                  icon={<Crosshair size={16} />}
                  label="웨지 미스"
                  unrecorded={wedgeRecorded === 0}
                  value={wedgeRecorded === 0 ? '–' : `${wedgeMiss}회`}
                  sub={wedgeRecorded === 0 ? '미기록' : `시도 ${wedgeTotal}홀 중`}
                  onClick={() => setActiveMetric('웨지온실패')}
                />
                <StatCard
                  icon={<Target size={16} />}
                  label="어프로치 성공률"
                  unrecorded={approachRecorded === 0}
                  value={approachRecorded === 0 ? '–' : `${approachPct}%`}
                  sub={approachRecorded === 0 ? '미기록' : `${approachSuccess} / ${approachAttempts}홀 성공`}
                  onClick={() => setActiveMetric('어프로치성공률')}
                />
                <StatCard icon={<Disc size={16} />} label="퍼팅" value={`총 ${totalPutts}개`} sub={`3퍼팅 이상 ${threePuttPlus}홀`} onClick={() => setActiveMetric('퍼팅')} />
                <StatCard
                  icon={<CheckCircle size={16} />}
                  label="숏퍼팅 성공률"
                  unrecorded={shortPuttRecorded === 0}
                  value={shortPuttRecorded === 0 ? '–' : `${shortPuttPct}%`}
                  sub={shortPuttRecorded === 0 ? '미기록' : `성공 ${shortPuttSuccess} / 전체 ${puttMissHoles.length}`}
                  onClick={() => setActiveMetric('숏퍼팅성공률')}
                />
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
                    <p className="text-xs font-semibold text-gray-500 mb-2">벌타 추이</p>
                    <SegmentLineChart
                      points={chart6Penalty}
                      lineColor="#E24B4A"
                      avgValue={avgChartPenalty}
                      caption="벌타 추이 · 최근 6라운드 (낮을수록 좋음)"
                      formatValue={v => `${v}`}
                      yMin={0}
                    />
                    <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                    <RankedMissBarChart items={teeMissBars} />
                    <SegmentCardFootnote>
                      * 평균 벌타는 OB 1회 = 2타, 해저드 1회 = 1타로 계산합니다
                    </SegmentCardFootnote>
                  </div>
                )}

                {activeSegment === 'second' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">세컨샷</h3>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <MetricCell label="GIR" value={`${segSecondGir}홀`} valueClass="text-blue-500" />
                      <MetricCell label="치명미스" value={`${fatalMissCount}`} valueClass="text-red-500" />
                      <MetricCell label="웨지 미스" value={`${wedgeMiss}`} valueClass="text-amber-600" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">치명미스 추이</p>
                    <SegmentLineChart
                      points={chart6CriticalMiss}
                      lineColor="#E24B4A"
                      avgValue={avgChartCriticalMiss}
                      caption="치명미스 추이 · 최근 6라운드 (낮을수록 좋음)"
                      formatValue={v => `${v}`}
                      yMin={0}
                    />
                    <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                    <RankedMissBarChart items={secondMissBars} />
                    <SegmentCardFootnote>
                      * 치명미스: 세컨샷 후 40m 이내의 어프로치 불가 또는 OB, 해저드로 이어진 경우
                    </SegmentCardFootnote>
                  </div>
                )}

                {activeSegment === 'approach' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">어프로치</h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <MetricCell label="20m이내 3m안착" value={approach20Total === 0 ? '–' : `${approach20Success} / ${approach20Total}`} valueClass="text-teal-600" />
                      <MetricCell label="20~40m 5m안착" value={approach2040Total === 0 ? '–' : `${approach2040Success} / ${approach2040Total}`} valueClass="text-amber-600" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">어프로치 성공률 추이</p>
                    <SegmentLineChart
                      points={chart6ApproachSuccess}
                      lineColor="#1D9E75"
                      avgValue={avgChartApproachSuccess}
                      caption="어프로치 성공률 추이 · 최근 6라운드 (높을수록 좋음)"
                      formatValue={v => `${v}%`}
                      yMin={0}
                      yMax={100}
                    />
                    <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">미스 TOP5</p>
                    <RankedMissBarChart items={approachMissBars} />
                    <SegmentCardFootnote>
                      * 어프로치 성공률: 20m이내 3m안착 + 20~40m 5m안착 합산 기준
                    </SegmentCardFootnote>
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
                    <p className="text-xs font-semibold text-gray-500 mb-2">숏퍼팅 미스 추이</p>
                    <SegmentLineChart
                      points={chart6ShortPuttMiss}
                      lineColor="#E24B4A"
                      avgValue={avgChartShortPuttMiss}
                      caption="숏퍼팅 미스 추이 · 최근 6라운드 (낮을수록 좋음)"
                      formatValue={v => `${v}`}
                      yMin={0}
                    />
                    <p className="text-xs font-semibold text-gray-500 mb-2 mt-4">홀별 퍼팅 분포</p>
                    <ColoredBarChart
                      items={[
                        { label: '1퍼팅', avg: putt1, color: '#1D9E75' },
                        { label: '2퍼팅', avg: putt2, color: '#378ADD' },
                        { label: '3퍼팅', avg: putt3, color: '#EF9F27' },
                        { label: '4퍼팅+', avg: putt4plus, color: '#E24B4A' },
                      ]}
                    />
                    <SegmentCardFootnote>* 숏퍼팅: 2m 이내 홀인 퍼팅</SegmentCardFootnote>
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
