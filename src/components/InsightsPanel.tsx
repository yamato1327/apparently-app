import { useState, useEffect, useCallback, useMemo } from "react";
import { format, addDays } from "date-fns";
import { FamEvent } from "@/types/events";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lightbulb, Sunrise, Car, Moon, Clock, ChevronDown, Trophy, RefreshCw } from "lucide-react";

interface InsightsPanelProps {
  events: FamEvent[];
  children?: { id?: string; name: string; emoji: string }[];
}

interface InsightTip {
  emoji: string;
  text: string;
  type: string;
  priority: "high" | "medium" | "low";
  childName?: string;
}

interface MilestoneFocus {
  title: string;
  emoji: string;
  daysUntil: number;
  childName?: string;
  tips: string[];
}

type SlotKey = "today_morning" | "today_pickup" | "today_evening" | "tomorrow_morning" | "tomorrow_pickup";

type SlotPart = "morning" | "pickup" | "evening";

interface SlotConfig {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
}

const SLOT_DEFS: Record<SlotKey, { day: "today" | "tomorrow"; part: SlotPart; sublabel: string; icon: React.ReactNode; gradient: string; iconBg: string }> = {
  today_morning: {
    day: "today",
    part: "morning",
    sublabel: "Breakfast & School Run",
    icon: <Sunrise className="h-4 w-4" />,
    gradient: "from-amber-400/8 to-orange-400/4",
    iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  today_pickup: {
    day: "today",
    part: "pickup",
    sublabel: "After School Reconnect",
    icon: <Car className="h-4 w-4" />,
    gradient: "from-primary/8 to-primary-glow/4",
    iconBg: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
  },
  today_evening: {
    day: "today",
    part: "evening",
    sublabel: "Wind Down & Reflect",
    icon: <Moon className="h-4 w-4" />,
    gradient: "from-secondary/8 to-secondary/4",
    iconBg: "bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-secondary",
  },
  tomorrow_morning: {
    day: "tomorrow",
    part: "morning",
    sublabel: "Prep for the Morning",
    icon: <Sunrise className="h-4 w-4" />,
    gradient: "from-amber-400/8 to-orange-400/4",
    iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  tomorrow_pickup: {
    day: "tomorrow",
    part: "pickup",
    sublabel: "After School Preview",
    icon: <Car className="h-4 w-4" />,
    gradient: "from-primary/8 to-primary-glow/4",
    iconBg: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
  },
};

const PART_LABEL: Record<SlotPart, string> = {
  morning: "Morning",
  pickup: "Pick Up",
  evening: "Evening",
};

const CACHE_KEY = "parent_tips_cache";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

function loadFromCache(date: string, todayCount: number, tomorrowCount: number, milestoneCount: number) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (
      cached.date !== date ||
      cached.todayCount !== todayCount ||
      cached.tomorrowCount !== tomorrowCount ||
      cached.milestoneCount !== milestoneCount ||
      Date.now() - cached.timestamp > CACHE_TTL_MS
    ) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function saveToCache(date: string, todayCount: number, tomorrowCount: number, milestoneCount: number, data: unknown) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      date,
      todayCount,
      tomorrowCount,
      milestoneCount,
      timestamp: Date.now(),
      data,
    }));
  } catch { /* ignore storage errors */ }
}

function getSlotLabel(now: Date, slot: SlotKey): string {
  const def = SLOT_DEFS[slot];
  const date = def.day === "today" ? now : addDays(now, 1);
  const dayName = format(date, "EEEE"); // e.g. "Friday"
  return `${dayName} ${PART_LABEL[def.part]}`;
}

const TYPE_STYLES: Record<string, string> = {
  must_take: "border-l-destructive bg-destructive/5 dark:bg-destructive/10",
  breakfast_question: "border-l-amber-400 bg-amber-50/40 dark:bg-amber-900/10",
  pack_reminder: "border-l-orange-400 bg-orange-50/40 dark:bg-orange-900/10",
  leave_reminder: "border-l-destructive bg-destructive/5 dark:bg-destructive/10",
  mindset: "border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10",
  reconnect_question: "border-l-primary bg-primary/5 dark:bg-primary/10",
  afternoon_brief: "border-l-sky-400 bg-sky-50/40 dark:bg-sky-900/10",
  snack_tip: "border-l-amber-400 bg-amber-50/30 dark:bg-amber-900/10",
  reflection_question: "border-l-secondary bg-secondary/5 dark:bg-secondary/10",
  tomorrow_prep: "border-l-primary bg-primary/5 dark:bg-primary/10",
  pack_tomorrow: "border-l-orange-400 bg-orange-50/40 dark:bg-orange-900/10",
  bedtime_ritual: "border-l-secondary bg-secondary/5 dark:bg-secondary/10",
  parent_reflection: "border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10",
};

/** Pick the 3 most relevant columns based on current hour */
function getVisibleSlots(hour: number): SlotKey[] {
  if (hour < 10) {
    return ["today_morning", "today_pickup", "today_evening"];
  } else if (hour < 14) {
    return ["today_pickup", "today_evening", "tomorrow_morning"];
  } else if (hour < 18) {
    return ["today_evening", "tomorrow_morning", "tomorrow_pickup"];
  } else {
    // Evening / night — today's evening + tomorrow
    return ["today_evening", "tomorrow_morning", "tomorrow_pickup"];
  }
}

function getTimeLabel(hour: number): string {
  if (hour < 10) return "Morning Mode";
  if (hour < 14) return "Midday Mode";
  if (hour < 18) return "Afternoon Mode";
  return "Evening Mode";
}

const InsightsPanel = ({ events, children: familyChildren }: InsightsPanelProps) => {
  const now = new Date();
  const currentHour = now.getHours();
  const today = format(now, "yyyy-MM-dd");
  const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");

  const todayEvents = events.filter((e) => e.date === today);
  const tomorrowEvents = events.filter((e) => e.date === tomorrow);

  const [insights, setInsights] = useState<Record<SlotKey, InsightTip[]>>({
    today_morning: [],
    today_pickup: [],
    today_evening: [],
    tomorrow_morning: [],
    tomorrow_pickup: [],
  });
  const [milestoneFocus, setMilestoneFocus] = useState<MilestoneFocus[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleSlot = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Compute active milestones (within their reminder window)
  const activeMilestones = useMemo(() => {
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    return events
      .filter((e) => e.isMilestone && !e.isCompleted)
      .map((e) => {
        const target = new Date(e.date + "T00:00:00");
        const daysUntil = Math.round((target.getTime() - todayDate.getTime()) / 86_400_000);
        return { event: e, daysUntil };
      })
      .filter(({ event, daysUntil }) => {
        const lead = event.milestoneRemindDaysBefore ?? 7;
        return daysUntil >= 0 && daysUntil <= lead;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [events]);

  const fetchInsights = useCallback(async () => {
    const cached = loadFromCache(today, todayEvents.length, tomorrowEvents.length, activeMilestones.length);
    if (cached) {
      setInsights({
        today_morning: cached.today_morning || [],
        today_pickup: cached.today_pickup || [],
        today_evening: cached.today_evening || [],
        tomorrow_morning: cached.tomorrow_morning || [],
        tomorrow_pickup: cached.tomorrow_pickup || [],
      });
      setMilestoneFocus(cached.milestone_focus || []);
      setHasFetched(true);
      return;
    }

    setLoading(true);
    try {
      const mapEvents = (evts: FamEvent[]) =>
        evts.slice(0, 15).map((e) => ({
          title: e.title,
          date: e.date,
          time: e.time,
          category: e.category,
          childName: e.childName,
          description: e.description,
          isCompleted: e.isCompleted,
        }));

      const milestonesPayload = activeMilestones.map(({ event, daysUntil }) => ({
        title: event.title,
        date: event.date,
        daysUntil,
        childName: event.childName,
        category: event.category,
        description: event.description,
        remindDaysBefore: event.milestoneRemindDaysBefore ?? 7,
      }));

      const { data, error } = await supabase.functions.invoke("parent-tips", {
        body: {
          todayEvents: mapEvents(todayEvents),
          tomorrowEvents: mapEvents(tomorrowEvents),
          children: familyChildren?.map((c) => ({ name: c.name, emoji: c.emoji })) || [],
          currentHour,
          milestones: milestonesPayload,
        },
      });

      if (error) {
        console.error("Insights error:", error);
      } else {
        const result = {
          today_morning: data?.today_morning || [],
          today_pickup: data?.today_pickup || [],
          today_evening: data?.today_evening || [],
          tomorrow_morning: data?.tomorrow_morning || [],
          tomorrow_pickup: data?.tomorrow_pickup || [],
          milestone_focus: data?.milestone_focus || [],
        };
        saveToCache(today, todayEvents.length, tomorrowEvents.length, activeMilestones.length, result);
        setInsights({
          today_morning: result.today_morning,
          today_pickup: result.today_pickup,
          today_evening: result.today_evening,
          tomorrow_morning: result.tomorrow_morning,
          tomorrow_pickup: result.tomorrow_pickup,
        });
        setMilestoneFocus(result.milestone_focus);
      }
    } catch (err) {
      console.error("Failed to fetch insights:", err);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [today, todayEvents.length, tomorrowEvents.length, activeMilestones.length]);

  const handleRefresh = () => {
    localStorage.removeItem(CACHE_KEY);
    fetchInsights();
  };

  useEffect(() => {
    if (todayEvents.length > 0 || tomorrowEvents.length > 0 || activeMilestones.length > 0) {
      fetchInsights();
    } else {
      setHasFetched(true);
    }
  }, [todayEvents.length, tomorrowEvents.length, activeMilestones.length, fetchInsights]);

  const visibleSlots = getVisibleSlots(currentHour);

  return (
    <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold font-display text-foreground">
            Better Parent Insights
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Smart tips to help you be calmer, more present & organised
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 font-semibold">
            <Clock className="h-3 w-3" />
            {getTimeLabel(currentHour)}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
            📅 {todayEvents.length} today
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
            📆 {tomorrowEvents.length} tmrw
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh tips"
            className="inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-14">
          <div className="relative">
            <div className="absolute inset-0 rounded-full gradient-primary opacity-15 blur-xl animate-pulse-glow" />
            <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
          </div>
          <span className="text-sm text-muted-foreground font-medium">Thinking about your day...</span>
        </div>
      )}

      {/* No events */}
      {hasFetched && !loading && todayEvents.length === 0 && tomorrowEvents.length === 0 && activeMilestones.length === 0 && (
        <div className="px-6 pb-6">
          <p className="text-sm text-muted-foreground/60 italic text-center py-10">
            No events today or tomorrow — enjoy the calm! ☕
          </p>
        </div>
      )}

      {/* Milestone Countdown strip — full width, above time-of-day grid */}
      {!loading && hasFetched && milestoneFocus.length > 0 && (
        <div className="border-t bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-transparent dark:from-amber-900/15 dark:via-orange-900/10 dark:to-transparent px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-1.5 text-white shadow-sm">
              <Trophy className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-bold font-display text-foreground">Milestone Countdown</h3>
            <span className="ml-auto text-[10px] text-muted-foreground bg-background/70 rounded-full px-2 py-0.5 font-medium">
              {milestoneFocus.length} active
            </span>
          </div>
          <div className={`grid gap-3 ${milestoneFocus.length === 1 ? "grid-cols-1" : milestoneFocus.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
            {milestoneFocus.map((m, i) => {
              const countdownLabel =
                m.daysUntil === 0 ? "TODAY" :
                m.daysUntil === 1 ? "tomorrow" :
                `in ${m.daysUntil} days`;
              return (
                <div key={`${m.title}-${i}`} className="rounded-xl border border-amber-300/50 bg-card/80 backdrop-blur-sm p-3 shadow-soft hover:shadow-card transition-all">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl shrink-0">{m.emoji || "🏆"}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold font-display text-foreground truncate">{m.title}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 ${
                          m.daysUntil === 0
                            ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}>
                          {countdownLabel}
                        </span>
                        {m.childName && (
                          <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">
                            · {m.childName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {m.tips.map((tip, ti) => (
                      <li key={ti} className="flex gap-1.5 text-[11px] text-foreground leading-relaxed">
                        <span className="text-amber-500 shrink-0 mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3 Column Layout — time-contextual */}
      {!loading && hasFetched && (todayEvents.length > 0 || tomorrowEvents.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t">
          {visibleSlots.map((slotKey, slotIdx) => {
            const cfg = SLOT_DEFS[slotKey];
            const label = getSlotLabel(now, slotKey);
            const tips = insights[slotKey];
            const isTomorrow = slotKey.startsWith("tomorrow_");
            const isOpen = !!expanded[slotKey];
            return (
              <div key={slotKey} className={`${slotIdx < 2 ? "md:border-r" : ""} border-border`}>
                {/* Column header (clickable to expand/collapse) */}
                <button
                  type="button"
                  onClick={() => toggleSlot(slotKey)}
                  aria-expanded={isOpen}
                  className={`w-full text-left px-4 py-3.5 bg-gradient-to-b ${cfg.gradient} hover:brightness-105 transition`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg p-1.5 ${cfg.iconBg}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold font-display text-foreground">{label}</h3>
                        {isTomorrow && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider bg-accent/20 text-accent-foreground rounded-full px-1.5 py-0.5">
                            Tomorrow
                          </span>
                        )}
                        <span className="ml-auto text-[10px] font-semibold text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">
                          {tips.length}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {cfg.sublabel}
                        {!isOpen && <span className="ml-1.5 opacity-60">· tap to view</span>}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Tips (collapsed by default) */}
                {isOpen && (
                <div className="p-3 space-y-2">
                  {tips.length > 0 ? (
                    tips.map((tip, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border-l-[3px] px-3 py-2.5 transition-all hover:shadow-soft ${
                          TYPE_STYLES[tip.type] || "border-l-muted-foreground/30 bg-muted/20"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-sm mt-0.5 shrink-0">{tip.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-foreground leading-relaxed">{tip.text}</p>
                            {tip.childName && (
                              <p className="text-[9px] text-muted-foreground mt-1 font-semibold uppercase tracking-wider">
                                {tip.childName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-muted-foreground/40 italic text-center py-8">
                      No tips yet
                    </p>
                  )}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default InsightsPanel;
