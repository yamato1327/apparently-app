import { BookOpen, CalendarDays, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type MainTab = "plan" | "reading" | "development";

interface TabDef {
  key: MainTab;
  label: string;
  icon: ReactNode;
  badge?: number;
}

interface Props {
  active: MainTab;
  onChange: (t: MainTab) => void;
  badges?: Partial<Record<MainTab, number>>;
}

/**
 * Top-level segmented tab bar: Plan / Reading / Development. Optional badge
 * counts highlight tabs with fresh content. Styled to match the existing
 * glass aesthetic used by the calendar view toggle.
 */
export default function MainTabs({ active, onChange, badges }: Props) {
  const tabs: TabDef[] = [
    { key: "plan", label: "Plan", icon: <CalendarDays className="h-3.5 w-3.5" />, badge: badges?.plan },
    { key: "reading", label: "Reading", icon: <BookOpen className="h-3.5 w-3.5" />, badge: badges?.reading },
    { key: "development", label: "Development", icon: <Sparkles className="h-3.5 w-3.5" />, badge: badges?.development },
  ];

  return (
    <div role="tablist" aria-label="Main sections" className="relative inline-flex items-center gap-1 mb-6 glass rounded-full p-1 shadow-soft w-full sm:w-auto justify-center sm:justify-start">
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={`relative flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-full px-3 sm:px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              selected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {selected && (
              <span className="absolute inset-0 rounded-full gradient-primary shadow-glow" aria-hidden />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
              {!!tab.badge && tab.badge > 0 && (
                <span
                  className={`ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none min-w-[1.25rem] ${
                    selected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
                  }`}
                >
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
