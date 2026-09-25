// Bottom tab bar from the mockups: home, week map, stats, profile.
import { IconHome, IconMap, IconStats, IconUser } from '@/components/bits';

export type Tab = 'home' | 'map' | 'stats' | 'profile';

const TABS: Array<{ tab: Tab; label: string; Icon: typeof IconHome }> = [
  { tab: 'home', label: 'Home', Icon: IconHome },
  { tab: 'map', label: 'Week map', Icon: IconMap },
  { tab: 'stats', label: 'Stats', Icon: IconStats },
  { tab: 'profile', label: 'Profile', Icon: IconUser },
];

export function TabBar({
  active,
  onSelect,
}: {
  active: Tab | null;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <nav
      className="flex h-[58px] flex-none items-center justify-around border-t border-line bg-surface"
      aria-label="Main"
    >
      {TABS.map(({ tab, label, Icon }) => (
        <button
          key={tab}
          type="button"
          onClick={() => onSelect(tab)}
          aria-label={label}
          aria-current={active === tab ? 'page' : undefined}
          className={
            active === tab
              ? 'text-accent'
              : 'text-soft transition-colors hover:text-shade'
          }
        >
          <Icon size={22} />
        </button>
      ))}
    </nav>
  );
}
