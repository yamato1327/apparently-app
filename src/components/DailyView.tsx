import { useState } from "react";
import { format, addDays, isSameDay, isToday } from "date-fns";
import { FamEvent } from "@/types/events";
import EventCard from "./EventCard";
import { CalendarDays, Sparkles, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { expandRecurringEvents } from "@/lib/recurrence";
import { getLocalTimeZoneAbbr } from "@/lib/time";
import { useChildren } from "@/hooks/useChildren";

interface DailyViewProps {
  date: Date;
  events: FamEvent[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteOccurrence?: (id: string) => void;
  onEdit: (event: FamEvent) => void;
}

const DailyView = ({ date, events, onToggle, onDelete, onDeleteOccurrence, onEdit }: DailyViewProps) => {
  const [offset, setOffset] = useState(0);
  const [childFilter, setChildFilter] = useState<string>("all");
  const { children } = useChildren();
  const viewDate = addDays(date, offset);
  const dateStr = format(viewDate, "yyyy-MM-dd");
  const expanded = expandRecurringEvents(events, viewDate, viewDate);
  const allDayEvents = expanded
    .filter((e) => e.date === dateStr)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  const dayEvents = allDayEvents.filter((e) => {
    if (childFilter === "all") return true;
    if (childFilter === "family") return !e.childName || e.childName.trim() === "";
    return (e.childName || "").toLowerCase() === childFilter.toLowerCase();
  });

  const completed = dayEvents.filter((e) => e.isCompleted).length;
  const total = dayEvents.length;

  const showingToday = isToday(viewDate);
  const heading = showingToday
    ? "Today's Schedule"
    : `${format(viewDate, "EEE, d MMM")}`;
  const relativeLabel = showingToday
    ? null
    : offset === 1 ? "Tomorrow"
    : offset === -1 ? "Yesterday"
    : null;
  const tzAbbr = getLocalTimeZoneAbbr();

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Previous day"
            className="rounded-lg border bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="rounded-xl bg-primary/10 p-2">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold font-display text-foreground truncate">{heading}</h2>
            <p className="text-[10px] text-muted-foreground -mt-0.5">
              {relativeLabel ? `${relativeLabel} · ${tzAbbr}` : `Times shown in ${tzAbbr}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Next day"
            className="rounded-lg border bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!showingToday && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="ml-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-semibold hover:bg-primary/20 transition-all"
            >
              Today
            </button>
          )}
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full gradient-primary transition-all duration-500"
                style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {completed}/{total}
            </span>
          </div>
        )}
      </div>

      {(children.length > 0 || allDayEvents.some(e => !e.childName)) && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { key: "all", label: "All", emoji: "📋", count: allDayEvents.length },
            { key: "family", label: "Family", emoji: "👨‍👩‍👧", count: allDayEvents.filter(e => !e.childName || e.childName.trim() === "").length },
            ...children.map(c => ({
              key: c.name,
              label: c.name,
              emoji: c.emoji,
              count: allDayEvents.filter(e => (e.childName || "").toLowerCase() === c.name.toLowerCase()).length,
            })),
          ].map((chip) => {
            const active = childFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setChildFilter(chip.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="text-sm leading-none">{chip.emoji}</span>
                <span>{chip.label}</span>
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {dayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border bg-card">
          <div className="rounded-2xl bg-primary/5 p-4 mb-4">
            <Sparkles className="h-10 w-10 text-primary/40" />
          </div>
          <p className="text-sm text-muted-foreground font-semibold">
            No events {showingToday ? "today" : `on ${format(viewDate, "EEE d MMM")}`}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">Enjoy the free time! 🎊✨</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayEvents.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              onToggle={onToggle}
              onDelete={onDelete}
              onDeleteOccurrence={onDeleteOccurrence}
              onEdit={onEdit}
              index={i}
              prominentTime
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyView;
