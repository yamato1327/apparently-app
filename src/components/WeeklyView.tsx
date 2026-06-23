import { useState } from "react";
import { format, addDays, startOfWeek, getISOWeek } from "date-fns";
import { FamEvent } from "@/types/events";
import EventCard from "./EventCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { expandRecurringEvents } from "@/lib/recurrence";

interface WeeklyViewProps {
  currentDate: Date;
  events: FamEvent[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteOccurrence?: (id: string) => void;
  onEdit: (event: FamEvent) => void;
  weekOffset?: number;
}

const getBusyLevel = (count: number, max: number): { label: string; emoji: string; barClass: string } => {
  if (count === 0) return { label: "Free", emoji: "😌", barClass: "bg-muted" };
  const ratio = count / max;
  if (ratio <= 0.33) return { label: "Light", emoji: "🟢", barClass: "bg-green-400" };
  if (ratio <= 0.66) return { label: "Moderate", emoji: "🟡", barClass: "bg-yellow-400" };
  return { label: "Busy!", emoji: "🔥", barClass: "bg-destructive" };
};

const WeeklyView = ({ currentDate, events, onToggle, onDelete, onDeleteOccurrence, onEdit, weekOffset = 0 }: WeeklyViewProps) => {
  const weekStart = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = weekOffset === 0 ? "This Week" : "Next Week";

  const expanded = expandRecurringEvents(events, weekStart, addDays(weekStart, 6));

  const todayIndex = days.findIndex(d => format(d, "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd"));
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayIndex >= 0 ? todayIndex : 0);

  const dayCounts = days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return expanded.filter((e) => e.date === dateStr).length;
  });
  const maxCount = Math.max(...dayCounts, 1);

  const selectedDay = days[selectedDayIndex];
  const selectedDateStr = format(selectedDay, "yyyy-MM-dd");
  const selectedDayEvents = expanded
    .filter((e) => e.date === selectedDateStr)
    .sort((a, b) => {
      const aRec = a.isRecurring ? 1 : 0;
      const bRec = b.isRecurring ? 1 : 0;
      if (aRec !== bRec) return aRec - bRec;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });
  const selectedBusy = getBusyLevel(dayCounts[selectedDayIndex], maxCount);

  return (
    <div>
      <h2 className="text-lg font-bold font-display text-foreground mb-4">🗓️ {weekLabel} · Week {getISOWeek(weekStart)} · {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}</h2>

      {/* Week heat map overview - clickable days */}
      <div className="grid grid-cols-7 gap-1.5 mb-6 p-3 rounded-xl border bg-card shadow-soft">
        {days.map((day, i) => {
          const count = dayCounts[i];
          const busy = getBusyLevel(count, maxCount);
          const isToday = format(day, "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd");
          const isSelected = i === selectedDayIndex;

          return (
            <button
              key={i}
              onClick={() => setSelectedDayIndex(i)}
              className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-all cursor-pointer ${
                isSelected ? "ring-2 ring-primary bg-primary/5" : isToday ? "bg-accent/30" : "hover:bg-accent/20"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                {format(day, "EEE")}
              </span>
              <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                {format(day, "d")}
              </span>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${busy.barClass} transition-all duration-500`}
                  style={{ width: count > 0 ? `${(count / maxCount) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-[10px]">{busy.emoji}</span>
              <span className="text-[9px] text-muted-foreground font-medium">{count} event{count !== 1 ? "s" : ""}</span>
            </button>
          );
        })}
      </div>

      {/* Day navigation arrows + selected day detail */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setSelectedDayIndex(Math.max(0, selectedDayIndex - 1))}
            disabled={selectedDayIndex === 0}
            className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {format(selectedDay, "EEEE")}
            </span>
            <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              {format(selectedDay, "MMM d")}
            </span>
            {selectedDayEvents.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {selectedBusy.emoji} {selectedDayEvents.length} event{selectedDayEvents.length > 1 ? "s" : ""} · {selectedBusy.label}
              </span>
            )}
          </div>
          <button
            onClick={() => setSelectedDayIndex(Math.min(6, selectedDayIndex + 1))}
            disabled={selectedDayIndex === 6}
            className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </div>

        {selectedDayEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic pl-1 pb-1">😌 Nothing planned</p>
        ) : (
          <div className="space-y-2">
            {selectedDayEvents.map((event, j) => (
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
    </div>
  );
};

export default WeeklyView;
