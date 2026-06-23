import { Clock, Package, Trophy } from "lucide-react";
import { useMemo } from "react";
import { useNextEvent } from "@/hooks/useNextEvent";
import { useReminders } from "@/hooks/useReminders";
import type { FamEvent } from "@/types/events";

interface Props {
  events: FamEvent[];
  onJumpToPlan: () => void;
}

/**
 * Always-visible "what's happening right now" strip. Shows up to three live
 * chips: next-event countdown, reminder count, and active milestone. Hides
 * itself entirely when nothing is worth showing.
 */
export default function NowNextStrip({ events, onJumpToPlan }: Props) {
  const { event: nextEvent, countdown } = useNextEvent(events);
  const { reminders } = useReminders();

  // Reminders relevant in the next 48h.
  const activeReminders = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 48);
    return reminders.filter((r) => {
      if (r.isDismissed) return false;
      const expires = new Date(r.expiresAfter);
      return expires >= now && new Date(r.noticeDate) <= horizon;
    });
  }, [reminders]);

  // Active milestone — within its remind-window.
  const activeMilestone = useMemo<FamEvent | null>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const candidates = events
      .filter((e) => e.isMilestone && !e.isCompleted)
      .map((e) => {
        const [y, m, d] = e.date.split("-").map(Number);
        const when = new Date(y, (m ?? 1) - 1, d ?? 1);
        const days = Math.round((when.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ev: e, days };
      })
      .filter((x) => {
        const lead = x.ev.milestoneRemindDaysBefore ?? 7;
        return x.days >= 0 && x.days <= lead;
      })
      .sort((a, b) => a.days - b.days);
    return candidates[0]?.ev ?? null;
  }, [events]);

  const milestoneDays = useMemo(() => {
    if (!activeMilestone) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = activeMilestone.date.split("-").map(Number);
    const when = new Date(y, (m ?? 1) - 1, d ?? 1);
    return Math.round((when.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [activeMilestone]);

  const hasAny = nextEvent || activeReminders.length > 0 || activeMilestone;
  if (!hasAny) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {nextEvent && (
        <button
          onClick={onJumpToPlan}
          className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-2 text-xs font-semibold text-foreground shadow-soft hover:scale-[1.02] transition-transform"
          title="Jump to your plan"
        >
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="text-base leading-none">{nextEvent.emoji ?? "📅"}</span>
          <span className="truncate max-w-[180px]">{nextEvent.title}</span>
          <span className="text-muted-foreground font-normal">·</span>
          <span className="text-primary">{countdown}</span>
        </button>
      )}

      {activeReminders.length > 0 && (
        <button
          onClick={onJumpToPlan}
          className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-2 text-xs font-semibold text-foreground shadow-soft hover:scale-[1.02] transition-transform"
          title="See reminders"
        >
          <Package className="h-3.5 w-3.5 text-amber-500" />
          <span>
            {activeReminders.length} thing{activeReminders.length === 1 ? "" : "s"} to bring
          </span>
        </button>
      )}

      {activeMilestone && (
        <button
          onClick={onJumpToPlan}
          className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-2 text-xs font-semibold text-foreground shadow-soft hover:scale-[1.02] transition-transform"
          title="See milestone"
        >
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-base leading-none">{activeMilestone.emoji ?? "🏆"}</span>
          <span className="truncate max-w-[160px]">{activeMilestone.title}</span>
          <span className="text-muted-foreground font-normal">·</span>
          <span className="text-amber-600 dark:text-amber-400">
            {milestoneDays === 0 ? "today" : milestoneDays === 1 ? "tomorrow" : `in ${milestoneDays}d`}
          </span>
        </button>
      )}
    </div>
  );
}
