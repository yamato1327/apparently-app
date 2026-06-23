import { useMemo, useState } from "react";
import { format, addDays, isBefore, parseISO } from "date-fns";
import { Bell, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import ReminderCard from "./ReminderCard";
import QuickReminderDialog from "./QuickReminderDialog";

const RemindersStrip = () => {
  const { reminders, dismissReminder, deleteReminder } = useReminders();
  const [showAdd, setShowAdd] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // Active = not yet expired (expires_after >= today)
  const active = useMemo(
    () =>
      reminders
        .filter((r) => !isBefore(parseISO(r.expiresAfter), parseISO(todayStr)))
        .sort((a, b) => {
          // priority high first, then by notice_date asc
          if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
          if (a.isDismissed !== b.isDismissed) return a.isDismissed ? 1 : -1;
          return a.noticeDate.localeCompare(b.noticeDate);
        }),
    [reminders, todayStr]
  );

  const todayList = active.filter((r) => r.noticeDate <= todayStr);
  const upcomingList = active.filter((r) => r.noticeDate > todayStr);

  const visibleUpcoming = showAll ? upcomingList : upcomingList.slice(0, 2);

  // Hide entirely when nothing active AND user hasn't opted to add
  if (active.length === 0 && !showAdd) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/40 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
        <div className="rounded-lg bg-muted/60 p-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          No reminders right now. Got a teacher notice (uniforms, library books, dress-up day…)?
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
        >
          <Plus className="h-3 w-3" /> Quick reminder
        </button>
        <QuickReminderDialog open={showAdd} onClose={() => setShowAdd(false)} />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="rounded-lg bg-primary/10 p-2">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold font-display text-foreground">Notices & Reminders</h2>
            <p className="text-[11px] text-muted-foreground">
              {todayList.length > 0
                ? `${todayList.length} for today${upcomingList.length > 0 ? ` · ${upcomingList.length} coming up` : ""}`
                : `${upcomingList.length} coming up`}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-[11px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        {/* Today */}
        {todayList.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Today
            </p>
            {todayList.map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                onDismiss={dismissReminder}
                onDelete={deleteReminder}
              />
            ))}
          </div>
        )}

        {/* Upcoming */}
        {upcomingList.length > 0 && (
          <div
            className={`px-4 py-3 space-y-2 ${
              todayList.length > 0 ? "border-t bg-muted/20" : ""
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Coming up
            </p>
            {visibleUpcoming.map((r) => (
              <div key={r.id}>
                <p className="text-[10px] text-muted-foreground/80 px-1 mb-1">
                  {r.noticeDate === tomorrowStr
                    ? "Tomorrow"
                    : format(parseISO(r.noticeDate), "EEE, d MMM")}
                </p>
                <ReminderCard
                  reminder={r}
                  onDismiss={dismissReminder}
                  onDelete={deleteReminder}
                />
              </div>
            ))}
            {upcomingList.length > 2 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground py-1.5"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> Show {upcomingList.length - 2} more
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <QuickReminderDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </>
  );
};

export default RemindersStrip;
