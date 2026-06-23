import { useState } from "react";
import { EventCategory, CATEGORY_CONFIG, FamEvent, RecurrenceCycle, MILESTONE_DEFAULT_DAYS, MILESTONE_LEAD_OPTIONS } from "@/types/events";
import { useChildren } from "@/hooks/useChildren";
import { X, RefreshCw, Trophy } from "lucide-react";
import EventAttachments from "./EventAttachments";

interface EditEventDialogProps {
  event: FamEvent | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<FamEvent, "id">>) => void;
}

// "custom" is a UI-only mode persisted as weekly + recurrenceDays.
type RecurrenceUiMode = RecurrenceCycle | "custom";

const RECURRENCE_OPTIONS: { value: RecurrenceUiMode; label: string; emoji: string }[] = [
  { value: "daily", label: "Daily", emoji: "📆" },
  { value: "weekly", label: "Weekly", emoji: "🗓️" },
  { value: "custom", label: "Custom", emoji: "✨" },
  { value: "monthly", label: "Monthly", emoji: "📅" },
];

const WEEKDAYS: { idx: number; label: string }[] = [
  { idx: 1, label: "M" },
  { idx: 2, label: "T" },
  { idx: 3, label: "W" },
  { idx: 4, label: "T" },
  { idx: 5, label: "F" },
  { idx: 6, label: "S" },
  { idx: 0, label: "S" },
];

const EditEventDialog = ({ event, onClose, onSave }: EditEventDialogProps) => {
  const { children } = useChildren();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [date, setDate] = useState(event?.date ?? "");
  const [time, setTime] = useState(event?.time ?? "");
  const [category, setCategory] = useState<EventCategory>(event?.category ?? "general");
  const [childName, setChildName] = useState(event?.childName ?? "");
  const [isRecurring, setIsRecurring] = useState(event?.isRecurring ?? false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(event?.recurrenceDays ?? []);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceUiMode>(() => {
    const cycle = event?.recurrenceCycle ?? "weekly";
    if (cycle === "weekly" && (event?.recurrenceDays?.length ?? 0) > 0) return "custom";
    return cycle;
  });
  const [isMilestone, setIsMilestone] = useState(event?.isMilestone ?? false);
  const [milestoneDays, setMilestoneDays] = useState<number>(event?.milestoneRemindDaysBefore ?? 7);

  if (!event) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const isCustom = recurrenceMode === "custom";
    const seedWeekday = (() => {
      try { return new Date(date).getDay(); } catch { return 1; }
    })();
    const customDays = recurrenceDays.length > 0 ? [...recurrenceDays].sort() : [seedWeekday];
    const persistedCycle: RecurrenceCycle = isCustom ? "weekly" : (recurrenceMode as RecurrenceCycle);
    onSave(event.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      time: time || undefined,
      category,
      childName: childName || undefined,
      isRecurring,
      recurrenceCycle: isRecurring ? persistedCycle : undefined,
      recurrenceDays: isRecurring && isCustom ? customDays : [],
      isMilestone,
      milestoneRemindDaysBefore: isMilestone ? milestoneDays : undefined,
    });
    onClose();
  };

  const toggleDay = (idx: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
    );
  };

  const selectMode = (mode: RecurrenceUiMode) => {
    setRecurrenceMode(mode);
    if (mode === "custom" && recurrenceDays.length === 0) {
      const seedWeekday = (() => {
        try { return new Date(date).getDay(); } catch { return 1; }
      })();
      setRecurrenceDays([seedWeekday]);
    }
  };

  const childOptions = [
    { label: "None", value: "" },
    ...children.map((c) => ({ label: `${c.emoji || '👦'} ${c.name}`, value: c.name })),
    { label: "👨‍👩‍👧‍👦 Family", value: "Family" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-elevated mx-4 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold font-display text-foreground">✏️ Edit Event</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">👤 Child</label>
            <div className="flex flex-wrap gap-2">
              {childOptions.map((opt) => (
                <button type="button" key={opt.value} onClick={() => setChildName(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    childName === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recurring */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">🔁 Recurrence</label>
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setIsRecurring(false)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  !isRecurring ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                One-off
              </button>
              <button type="button" onClick={() => setIsRecurring(true)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all inline-flex items-center gap-1 ${
                  isRecurring ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                <RefreshCw className="h-3 w-3" /> Recurring
              </button>
            </div>
            {isRecurring && (
              <div className="flex flex-wrap gap-1.5">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button type="button" key={opt.value} onClick={() => selectMode(opt.value)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                      recurrenceMode === opt.value
                        ? "bg-secondary text-secondary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}>
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            )}
            {isRecurring && recurrenceMode === "custom" && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  Repeat on (pick any combination of weekdays)
                </p>
                <div className="flex gap-1">
                  {WEEKDAYS.map((d, i) => {
                    const active = recurrenceDays.includes(d.idx);
                    return (
                      <button
                        type="button"
                        key={`${d.idx}-${i}`}
                        onClick={() => toggleDay(d.idx)}
                        className={`h-8 w-8 rounded-full text-xs font-semibold transition-all ${
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
          </div>

          {/* Milestone */}
          <div className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-900/15 dark:to-orange-900/10 p-3">
            <label className="block text-xs font-semibold text-foreground mb-1.5 inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              Milestone
              <span className="font-normal text-[10px] text-muted-foreground">— big event with daily build-up tips</span>
            </label>
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setIsMilestone(false)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  !isMilestone ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                Regular
              </button>
              <button type="button" onClick={() => { setIsMilestone(true); if (!milestoneDays) setMilestoneDays(MILESTONE_DEFAULT_DAYS[category] || 7); }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all inline-flex items-center gap-1 ${
                  isMilestone ? "bg-amber-500 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                🏆 Milestone
              </button>
            </div>
            {isMilestone && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  Start daily reminders & insights:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MILESTONE_LEAD_OPTIONS.map((opt) => (
                    <button type="button" key={opt.value} onClick={() => setMilestoneDays(opt.value)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                        milestoneDays === opt.value
                          ? "bg-amber-500 text-white shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {opt.label} before
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={milestoneDays}
                    onChange={(e) => setMilestoneDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 rounded-full border bg-background px-2 py-1 text-[10px] text-foreground text-center focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    aria-label="Custom days before"
                  />
                  <span className="text-[10px] text-muted-foreground self-center">days</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(CATEGORY_CONFIG) as [EventCategory, typeof CATEGORY_CONFIG[EventCategory]][]).map(
                ([key, config]) => (
                  <button type="button" key={key} onClick={() => setCategory(key)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      category === key
                        ? `${config.colorClass} text-primary-foreground shadow-sm`
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}>
                    {config.icon} {config.label}
                  </button>
                )
              )}
            </div>
          </div>

          <button type="submit"
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-[0.98]">
            💾 Save Changes
          </button>
        </form>

        <div className="mt-4">
          <EventAttachments eventId={event.id} />
        </div>
      </div>
    </div>
  );
};

export default EditEventDialog;
