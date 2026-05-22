import { User, Settings, Bell, HelpCircle, LogOut, ChevronRight } from 'lucide-react';

export default function Profile() {
  const menuItems = [
    { icon: Settings, label: '설정', onClick: () => {} },
    { icon: Bell, label: '알림', onClick: () => {} },
    { icon: HelpCircle, label: '도움말', onClick: () => {} },
  ];

  return (
    <div className="min-h-screen bg-surface pb-28">
      {/* Header */}
      <div className="bg-[#1B4332] text-white px-4 pt-6 pb-8">
        <h1 className="text-xl font-bold tracking-tight">개인 정보</h1>
        <p className="text-green-200 text-sm mt-1">프로필 및 설정</p>
      </div>

      {/* Profile Card */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#1B4332]/10 flex items-center justify-center">
              <User size={32} className="text-[#1B4332]" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-800 text-lg">골퍼</p>
              <p className="text-sm text-gray-500 mt-0.5">Golf Memo 사용자</p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors ${
                  index < menuItems.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <Icon size={20} className="text-gray-500" />
                <span className="flex-1 text-sm font-medium text-gray-800">{item.label}</span>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Logout Button */}
      <div className="px-4 mt-4">
        <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl border border-gray-200 text-gray-500 font-medium text-sm active:bg-gray-50 transition-colors">
          <LogOut size={18} />
          <span>로그아웃</span>
        </button>
      </div>

      {/* App Version */}
      <div className="text-center mt-8">
        <p className="text-xs text-gray-400">Golf Memo v1.0.0</p>
      </div>
    </div>
  );
}
