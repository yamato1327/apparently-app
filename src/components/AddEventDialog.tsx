import { useState } from "react";
import { EventCategory, CATEGORY_CONFIG, RecurrenceCycle, MILESTONE_DEFAULT_DAYS, MILESTONE_LEAD_OPTIONS } from "@/types/events";
import { FamEvent } from "@/types/events";
import { useChildren } from "@/hooks/useChildren";
import { X, RefreshCw, Trophy } from "lucide-react";
import ScreenshotUpload from "@/components/ScreenshotUpload";

// "custom" is a UI-only mode persisted as weekly + recurrenceDays.
type RecurrenceUiMode = RecurrenceCycle | "custom";

const RECURRENCE_OPTIONS: { value: RecurrenceUiMode; label: string; emoji: string }[] = [
  { value: "daily", label: "Daily", emoji: "📆" },
  { value: "weekly", label: "Weekly", emoji: "🗓️" },
  { value: "custom", label: "Custom", emoji: "✨" },
  { value: "monthly", label: "Monthly", emoji: "📅" },
];

// Index 0 = Sunday ... 6 = Saturday (matches JS getDay()). Display order: Mon..Sun.
const WEEKDAYS: { idx: number; label: string }[] = [
  { idx: 1, label: "M" },
  { idx: 2, label: "T" },
  { idx: 3, label: "W" },
  { idx: 4, label: "T" },
  { idx: 5, label: "F" },
  { idx: 6, label: "S" },
  { idx: 0, label: "S" },
];

interface AddEventDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (event: Omit<FamEvent, "id">) => void;
}

const AddEventDialog = ({ open, onClose, onAdd }: AddEventDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("general");
  const [childName, setChildName] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceUiMode>("weekly");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [isMilestone, setIsMilestone] = useState(false);
  const [milestoneDays, setMilestoneDays] = useState<number>(7);
  const { children } = useChildren();

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const isCustom = recurrenceMode === "custom";
    // For custom, fall back to seed-date weekday if user picked nothing.
    const seedWeekday = (() => {
      try { return new Date(date).getDay(); } catch { return 1; }
    })();
    const customDays = recurrenceDays.length > 0 ? [...recurrenceDays].sort() : [seedWeekday];
    const persistedCycle: RecurrenceCycle = isCustom ? "weekly" : (recurrenceMode as RecurrenceCycle);

    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      time: time || undefined,
      category,
      childName: childName || undefined,
      isCompleted: false,
      isRecurring,
      recurrenceCycle: isRecurring ? persistedCycle : undefined,
      recurrenceDays: isRecurring && isCustom ? customDays : undefined,
      isMilestone,
      milestoneRemindDaysBefore: isMilestone ? milestoneDays : undefined,
    });

    setTitle("");
    setDescription("");
    setTime("");
    setCategory("general");
    setChildName("");
    setIsRecurring(false);
    setRecurrenceMode("weekly");
    setRecurrenceDays([]);
    setIsMilestone(false);
    setMilestoneDays(7);
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

  const toggleMilestone = (next: boolean) => {
    setIsMilestone(next);
    if (next) {
      // Suggest based on category
      setMilestoneDays((prev) => prev || MILESTONE_DEFAULT_DAYS[category] || 7);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-elevated mx-4 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold font-display text-foreground">New Event</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Soccer practice"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Any extra details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Child</label>
            {children.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setChildName("")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    childName === ""
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  None
                </button>
                {children.map((child) => (
                  <button
                    type="button"
                    key={child.id}
                    onClick={() => setChildName(child.name)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      childName === child.name
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {child.emoji || '👦'} {child.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setChildName("Family")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    childName === "Family"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  👨‍👩‍👧‍👦 Family
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. Emma"
              />
            )}
          </div>

          {/* Recurrence */}
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
                        aria-label={`Toggle weekday ${d.idx}`}
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
              <button type="button" onClick={() => toggleMilestone(false)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  !isMilestone ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                Regular
              </button>
              <button type="button" onClick={() => toggleMilestone(true)}
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
                  <span className="ml-1 italic">suggested {MILESTONE_DEFAULT_DAYS[category]} days for {CATEGORY_CONFIG[category].label.toLowerCase()}</span>
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
                  <button
                    type="button"
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      category === key
                        ? `${config.colorClass} text-primary-foreground shadow-sm`
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {config.icon} {config.label}
                  </button>
                )
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Add Event
          </button>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Or scan a document / photo instead
            </button>
          </div>
        </form>
      </div>

      <ScreenshotUpload
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onEventsExtracted={(newEvents) => {
          if (newEvents[0]) onAdd(newEvents[0]);
          setScanOpen(false);
          onClose();
        }}
      />
    </div>
  );
};

export default AddEventDialog;
