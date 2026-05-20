export type NavTab = 'new-round' | 'round-list' | 'all-rounds';

interface Props {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const TABS: { id: NavTab; label: string }[] = [
  { id: 'new-round', label: '라운드 기록' },
  { id: 'round-list', label: '라운드 목록' },
  { id: 'all-rounds', label: '전체 통계' },
];

export default function NavBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center px-4 pb-0">
        <div className="flex items-center gap-1.5 pb-3">
          <div className="w-6 h-6 rounded-full bg-[#1a6b3a] flex items-center justify-center">
            <div className="w-3 h-3 rounded-full border-2 border-white" />
          </div>
          <span className="text-sm font-bold text-gray-800 tracking-tight">Golf Memo</span>
        </div>
      </div>
      <div className="flex px-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
              activeTab === tab.id ? 'text-[#1a6b3a]' : 'text-gray-400'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#1a6b3a] rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
