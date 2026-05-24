import { Settings, Clock, Database } from 'lucide-react';

export default function Profile() {
  return (
    <div className="min-h-screen bg-surface pb-28">
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-xl font-bold text-gray-800">라운드 세팅</h1>
        <p className="text-sm text-gray-500 mt-1">앱 환경을 설정해요</p>
      </div>

      <div className="px-4 mt-2">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-700 mb-4">업데이트 예정 기능</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
                <Settings size={18} className="text-[#1B4332]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">태그 관리</p>
                <p className="text-xs text-gray-400 mt-0.5">골프장, 동반자 등 자주 쓰는 태그를 미리 등록해요</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-[#1B4332]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">클럽 관리</p>
                <p className="text-xs text-gray-400 mt-0.5">사용하는 골프채를 등록하고 기록에 연동해요</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
                <Database size={18} className="text-[#1B4332]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">데이터 관리</p>
                <p className="text-xs text-gray-400 mt-0.5">라운드 데이터를 백업하고 내보낼 수 있어요</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>        <div className="bg-[#1B4332]/5 rounded-2xl border border-[#1B4332]/10 p-4">
          <p className="text-xs text-[#1B4332] text-center leading-relaxed">
            세팅 기능은 순차적으로 업데이트될 예정이에요 😊
          </p>
        </div>
      </div>

      <div className="text-center mt-8">
        <p className="text-xs text-gray-400">Golf Memo v1.0.0</p>
      </div>
    </div>
  );
}