import { useState } from "react";
import { X, RefreshCw, Trophy, AlertTriangle, Link2 } from "lucide-react";
import { CATEGORY_CONFIG, MILESTONE_LEAD_OPTIONS, MILESTONE_DEFAULT_DAYS } from "@/types/events";
import type { DraftEvent } from "@/lib/normalizeDraft";
import { describeMatch, type SimilarMatch } from "@/lib/eventSimilarity";

const WEEKDAYS: { idx: number; label: string }[] = [
  { idx: 1, label: "M" },
  { idx: 2, label: "T" },
  { idx: 3, label: "W" },
  { idx: 4, label: "T" },
  { idx: 5, label: "F" },
  { idx: 6, label: "S" },
  { idx: 0, label: "S" },
];

interface ChildOption {
  label: string;
  value: string;
}

interface EventDraftRowProps {
  event: DraftEvent;
  onChange: (updates: Partial<DraftEvent>) => void;
  onRemove: () => void;
  childOptions: ChildOption[];
  /** Existing events that look like duplicates of this draft. */
  similarMatches?: SimilarMatch[];
  /** Called when user wants to merge this draft into an existing event id. */
  onLink?: (existingEventId: string) => void;
}

const EventDraftRow = ({
  event,
  onChange,
  onRemove,
  childOptions,
  similarMatches = [],
  onLink,
}: EventDraftRowProps) => {
  const cat = CATEGORY_CONFIG[event.category];
  const [dismissedDup, setDismissedDup] = useState(false);
  const showDupBanner = !dismissedDup && similarMatches.length > 0;
  const topMatch = similarMatches[0];

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2.5">
      {/* Duplicate banner */}
      {showDupBanner && topMatch && (
        <div
          className={`rounded-md border px-2.5 py-2 text-[11px] flex flex-col gap-1.5 ${
            topMatch.soft
              ? "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
              : "border-amber-400/50 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100"
          }`}
        >
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-none" />
            <div className="flex-1">
              <p className="font-semibold leading-tight">
                {topMatch.soft ? "Similar event found" : "Looks like a duplicate"}
              </p>
              <p className="opacity-90 leading-snug">{describeMatch(topMatch)}</p>
              {topMatch.soft && (
                <p className="opacity-70 leading-snug mt-0.5">
                  Different child — confirm if this is a separate event.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-5">
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full bg-background border px-2 py-0.5 text-[10px] font-semibold hover:bg-muted"
            >
              Skip
            </button>
            {onLink && (
              <button
                type="button"
                onClick={() => onLink(topMatch.event.id)}
                className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1 hover:opacity-90"
              >
                <Link2 className="h-2.5 w-2.5" /> Link to existing
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissedDup(true)}
              className="rounded-full bg-background border px-2 py-0.5 text-[10px] font-medium hover:bg-muted"
            >
              Add anyway
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-2">
        <span className="text-xl mt-0.5">{event.emoji || cat.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold font-display text-foreground">{event.title}</p>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">📅 {event.date}</span>
            {event.time && <span className="text-xs text-muted-foreground">🕐 {event.time}</span>}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-primary-foreground ${cat.colorClass}`}
            >
              {cat.label}
            </span>
            {event.isMilestone && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium">
                <Trophy className="h-2.5 w-2.5" /> Milestone
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="rounded-md p-1 text-muted-foreground hover:text-destructive transition-colors"
          title="Remove event"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Recurring */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">🔁 Frequency:</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ isRecurring: false })}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
              !event.isRecurring
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            One-off
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                isRecurring: true,
                recurrenceCycle: event.recurrenceCycle || "weekly",
                recurrenceMode: event.recurrenceMode || event.recurrenceCycle || "weekly",
              })
            }
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all inline-flex items-center gap-0.5 ${
              event.isRecurring
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <RefreshCw className="h-2.5 w-2.5" /> Recurring
          </button>
        </div>
        {event.isRecurring && (
          <div className="flex flex-wrap gap-1">
            {(["daily", "weekly", "custom", "monthly"] as const).map((mode) => {
              const active = (event.recurrenceMode || event.recurrenceCycle || "weekly") === mode;
              const emoji = mode === "daily" ? "📆" : mode === "weekly" ? "🗓️" : mode === "custom" ? "✨" : "📅";
              const label = mode.charAt(0).toUpperCase() + mode.slice(1);
              return (
                <button
                  type="button"
                  key={mode}
                  onClick={() => {
                    const patch: Partial<DraftEvent> = { recurrenceMode: mode };
                    if (mode === "custom") {
                      patch.recurrenceCycle = "weekly";
                      if (!event.recurrenceDays || event.recurrenceDays.length === 0) {
                        const seed = (() => {
                          try {
                            return new Date(event.date).getDay();
                          } catch {
                            return 1;
                          }
                        })();
                        patch.recurrenceDays = [seed];
                      }
                    } else {
                      patch.recurrenceCycle = mode;
                    }
                    onChange(patch);
                  }}
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-all ${
                    active
                      ? "bg-secondary text-secondary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {emoji} {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom weekday picker */}
      {event.isRecurring && event.recurrenceMode === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Repeat on:</span>
          <div className="flex gap-1">
            {WEEKDAYS.map((d, k) => {
              const days = event.recurrenceDays || [];
              const active = days.includes(d.idx);
              return (
                <button
                  type="button"
                  key={`${d.idx}-${k}`}
                  onClick={() => {
                    const next = active ? days.filter((x) => x !== d.idx) : [...days, d.idx];
                    onChange({ recurrenceDays: next });
                  }}
                  className={`h-6 w-6 rounded-full text-[10px] font-semibold transition-all ${
                    active
                      ? "bg-secondary text-secondary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  aria-pressed={active}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Milestone */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">🏆 Milestone:</span>
        <button
          type="button"
          onClick={() =>
            onChange({
              isMilestone: !event.isMilestone,
              milestoneRemindDaysBefore:
                !event.isMilestone
                  ? event.milestoneRemindDaysBefore ?? MILESTONE_DEFAULT_DAYS[event.category]
                  : undefined,
            })
          }
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
            event.isMilestone
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {event.isMilestone ? "On" : "Off"}
        </button>
        {event.isMilestone && (
          <div className="flex flex-wrap gap-1">
            {MILESTONE_LEAD_OPTIONS.map((opt) => {
              const active = (event.milestoneRemindDaysBefore ?? 7) === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => onChange({ milestoneRemindDaysBefore: opt.value })}
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-all ${
                    active
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Child tag */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">👤 Who:</span>
        {childOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ childName: opt.value })}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
              (event.childName || "") === opt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EventDraftRow;