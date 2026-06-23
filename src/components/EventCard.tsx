import { useState } from "react";
import { FamEvent, CATEGORY_CONFIG } from "@/types/events";
import { Check, Trash2, Clock, Pencil, ChevronDown, Trophy, X } from "lucide-react";
import { formatEventTime } from "@/lib/time";
import { getSeedId } from "@/lib/recurrence";
import EventAttachments from "./EventAttachments";

interface EventCardProps {
  event: FamEvent;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  /** When provided & event is recurring, deletes only this instance. */
  onDeleteOccurrence?: (id: string) => void;
  onEdit?: (event: FamEvent) => void;
  index?: number;
  /** Show a prominent left-rail time block (used in the daily view). */
  prominentTime?: boolean;
}

const EventCard = ({ event, onToggle, onDelete, onDeleteOccurrence, onEdit, index = 0, prominentTime = false }: EventCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cat = CATEGORY_CONFIG[event.category];
  const timeLabel = formatEventTime(event.time);

  // Days until the event for milestone display
  const daysUntil = (() => {
    if (!event.isMilestone) return null;
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const target = new Date(event.date + "T00:00:00");
      return Math.round((target.getTime() - today.getTime()) / 86_400_000);
    } catch { return null; }
  })();

  return (
    <div
      className={`group relative rounded-xl border bg-card shadow-soft transition-all hover:shadow-card animate-fade-in ${
        event.isCompleted ? "opacity-50" : ""
      } ${event.isMilestone ? "ring-1 ring-amber-400/40 shadow-[0_0_24px_-8px_hsl(45,95%,55%,0.5)]" : ""}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {event.isMilestone && (
        <div className="absolute -top-2 -right-2 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white px-2 py-0.5 text-[9px] font-bold shadow-md">
          <Trophy className="h-2.5 w-2.5" />
          {daysUntil !== null && daysUntil > 0 ? `in ${daysUntil}d` : daysUntil === 0 ? "TODAY" : "MILESTONE"}
        </div>
      )}
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-start gap-3 w-full text-left p-4"
      >
        {/* Prominent time rail (daily view) */}
        {prominentTime && (
          <div className="flex flex-col items-center justify-center min-w-[64px] pr-3 border-r border-border/60 self-stretch">
            {timeLabel ? (
              <>
                <span className="font-display font-bold text-base text-foreground tabular-nums leading-none">
                  {timeLabel}
                </span>
              </>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                All day
              </span>
            )}
          </div>
        )}

        {/* Category indicator */}
        <div className={`mt-0.5 h-10 w-1.5 flex-shrink-0 rounded-full ${cat.colorClass}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{event.emoji || cat.icon}</span>
            <h3
              className={`text-sm font-bold font-display truncate ${
                event.isCompleted ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {event.title}
            </h3>
          </div>

          {!expanded && event.description && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{event.description}</p>
          )}

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {event.time && !prominentTime && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timeLabel || event.time}
              </span>
            )}
            {event.childName && (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px] font-semibold">
                {event.childName}
              </span>
            )}
            {event.isRecurring && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/20 text-accent-foreground px-2.5 py-0.5 text-[10px] font-medium">
                🔁 {event.recurrenceCycle || "weekly"}
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground ${cat.colorClass}`}
            >
              {cat.label}
            </span>
          </div>
        </div>

        {/* Expand indicator */}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 mt-1.5 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0 animate-fade-in">
          <div className="pt-3.5 space-y-3">
            {event.description && (
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Details</span>
                <p className="text-xs text-foreground mt-1 whitespace-pre-wrap leading-relaxed">{event.description}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {event.time && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Time</span>
                  <p className="text-xs text-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {timeLabel || event.time}
                  </p>
                </div>
              )}
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</span>
                <p className="text-xs text-foreground mt-0.5">📅 {event.date}</p>
              </div>
              {event.childName && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Child</span>
                  <p className="text-xs text-foreground mt-0.5">👦 {event.childName}</p>
                </div>
              )}
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Category</span>
                <p className="text-xs text-foreground mt-0.5">{cat.icon} {cat.label}</p>
              </div>
              {event.isRecurring && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Repeats</span>
                  <p className="text-xs text-foreground mt-0.5">🔁 {event.recurrenceCycle || "weekly"}</p>
                </div>
              )}
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2 pt-1">
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(event.id); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  event.isCompleted
                    ? "bg-secondary/20 text-secondary"
                    : "bg-muted text-muted-foreground hover:bg-secondary/20 hover:text-secondary"
                }`}
              >
                <Check className="h-3 w-3" /> {event.isCompleted ? "Undo" : "Done"}
              </button>
              {event.isRecurring && onDeleteOccurrence ? (
                confirmingDelete ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Delete:</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteOccurrence(event.id);
                        setConfirmingDelete(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Just this one
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(getSeedId(event.id));
                        setConfirmingDelete(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" /> Whole series
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false); }}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors"
                      title="Cancel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
                    title="Delete just this one occurrence or the whole series"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-border/40">
              <EventAttachments eventId={event.id} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventCard;
