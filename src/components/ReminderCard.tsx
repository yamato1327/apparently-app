import { Check, X, Trash2 } from "lucide-react";
import type { Reminder } from "@/types/reminders";

interface ReminderCardProps {
  reminder: Reminder;
  onDismiss: (id: string) => void;
  onDelete?: (id: string) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  uniform: "👕",
  bring: "🎒",
  dress_up: "🎩",
  permission: "📝",
  general: "📌",
};

const ReminderCard = ({ reminder, onDismiss, onDelete }: ReminderCardProps) => {
  const emoji = reminder.emoji || CATEGORY_EMOJI[reminder.category] || "📌";
  const isHigh = reminder.priority === "high";

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-xl border bg-card/70 backdrop-blur-sm px-3.5 py-2.5 shadow-soft transition-all hover:shadow-card ${
        isHigh ? "border-l-4 border-l-secondary" : ""
      } ${reminder.isDismissed ? "opacity-50" : ""}`}
    >
      {/* Emoji */}
      <div
        className={`flex-none w-9 h-9 rounded-lg flex items-center justify-center text-lg ${
          isHigh ? "bg-secondary/15" : "bg-primary/10"
        }`}
        aria-hidden
      >
        {emoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-semibold text-foreground truncate ${
              reminder.isDismissed ? "line-through" : ""
            }`}
          >
            {reminder.title}
          </span>
          {isHigh && (
            <span className="inline-flex items-center rounded-full bg-secondary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-secondary">
              !
            </span>
          )}
        </div>
        {reminder.childName && (
          <p className="text-[11px] text-muted-foreground mt-0.5">for {reminder.childName}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {!reminder.isDismissed ? (
          <button
            onClick={() => onDismiss(reminder.id)}
            title="Mark done"
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground px-1.5">Done</span>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(reminder.id)}
            title="Delete"
            className="rounded-md p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ReminderCard;
