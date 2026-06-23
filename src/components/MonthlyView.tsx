import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getISOWeek,
} from "date-fns";
import { FamEvent, CATEGORY_CONFIG } from "@/types/events";
import { ChevronLeft, ChevronRight } from "lucide-react";
import EventCard from "./EventCard";
import { expandRecurringEvents } from "@/lib/recurrence";

interface MonthlyViewProps {
  currentDate: Date;
  events: FamEvent[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteOccurrence?: (id: string) => void;
  onEdit: (event: FamEvent) => void;
}

const MonthlyView = ({ currentDate, events, onToggle, onDelete, onDeleteOccurrence, onEdit }: MonthlyViewProps) => {
  const [viewMonth, setViewMonth] = useState(currentDate);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const expanded = expandRecurringEvents(events, calStart, calEnd);

  // Build weeks
  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const getEventsForDate = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
    return expanded.filter((e) => e.date === dateStr);
  };

  const selectedEvents = selectedDate
    ? expanded
        .filter((e) => e.date === selectedDate)
        .sort((a, b) => {
          const aRec = a.isRecurring ? 1 : 0;
          const bRec = b.isRecurring ? 1 : 0;
          if (aRec !== bRec) return aRec - bRec;
          return (a.time || "99:99").localeCompare(b.time || "99:99");
        })
    : [];

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-display text-foreground">
          📅 {format(viewMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setViewMonth(currentDate);
              setSelectedDate(null);
            }}
            className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((d) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const dayEvents = getEventsForDate(d);
              const isCurrentMonth = isSameMonth(d, viewMonth);
              const isToday = isSameDay(d, currentDate);
              const isSelected = selectedDate === dateStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`relative min-h-[72px] p-1.5 text-left border-r last:border-r-0 transition-colors ${
                    !isCurrentMonth ? "bg-muted/30" : ""
                  } ${isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"}`}
                >
                  <span
                    className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {format(d, "d")}
                  </span>

                  {/* Event dots / pills */}
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cat = CATEGORY_CONFIG[ev.category];
                      return (
                        <div
                          key={ev.id}
                          className={`truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight text-primary-foreground ${cat.colorClass} ${
                            ev.isCompleted ? "opacity-50 line-through" : ""
                          }`}
                        >
                          {ev.emoji || cat.icon} {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] text-muted-foreground font-medium pl-1">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="mt-4 animate-fade-in">
          <h3 className="text-sm font-bold text-foreground mb-2">
            📌 {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
            </span>
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 italic">😌 Nothing planned</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event, j) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onDeleteOccurrence={onDeleteOccurrence}
                  onEdit={onEdit}
                  index={j}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MonthlyView;
