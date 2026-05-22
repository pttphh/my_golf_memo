import { Flag, BarChart3, Settings, User } from 'lucide-react';

export type NavTab = 'round-list' | 'all-rounds' | 'new-round' | 'profile';

interface Props {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const TABS: { id: NavTab; label: string; icon: typeof Flag }[] = [
  { id: 'round-list', label: '라운드', icon: Flag },
  { id: 'all-rounds', label: '통계', icon: BarChart3 },
  { id: 'new-round', label: '세팅', icon: Settings },
  { id: 'profile', label: '개인', icon: User },
];

export default function BottomNav({ activeTab, onTabChange }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-[390px] px-4 pointer-events-auto">
        <nav className="bg-white rounded-full shadow-lg border border-gray-100 px-2 py-2 flex items-center">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-full transition-all ${
                  isActive 
                    ? 'bg-[#1B4332]/10' 
                    : ''
                }`}
              >
                <Icon 
                  size={20} 
                  className={`transition-colors ${isActive ? 'text-[#1B4332]' : 'text-gray-400'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-[#1B4332]' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
