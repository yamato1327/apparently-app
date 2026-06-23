import { FamEvent } from "@/types/events";

export interface DraftEvent {
  title: string;
  description?: string;
  date: string;
  time?: string | null;
  category: "school" | "sports" | "medical" | "social" | "general";
  childName?: string | null;
  emoji?: string;
  isRecurring?: boolean;
  recurrenceCycle?: "daily" | "weekly" | "monthly";
  /** UI-only mode. "custom" persists as weekly + recurrenceDays. */
  recurrenceMode?: "daily" | "weekly" | "custom" | "monthly";
  /** 0=Sun..6=Sat */
  recurrenceDays?: number[];
  isMilestone?: boolean;
  milestoneRemindDaysBefore?: number;
}

/** Convert a draft event from the AI / review UI into the persisted FamEvent shape. */
export function normalizeDraft(e: DraftEvent): Omit<FamEvent, "id"> {
  const isCustom = e.recurrenceMode === "custom";
  const seedWeekday = (() => {
    try {
      return new Date(e.date).getDay();
    } catch {
      return 1;
    }
  })();
  const days =
    e.recurrenceDays && e.recurrenceDays.length > 0
      ? [...e.recurrenceDays].sort()
      : [seedWeekday];
  const persistedCycle: "daily" | "weekly" | "monthly" = isCustom
    ? "weekly"
    : ((e.recurrenceMode as "daily" | "weekly" | "monthly" | undefined) ||
        e.recurrenceCycle ||
        "weekly");

  return {
    title: e.title,
    description: e.description,
    date: e.date,
    time: e.time || undefined,
    category: e.category,
    childName: e.childName || undefined,
    emoji: e.emoji,
    isCompleted: false,
    isRecurring: e.isRecurring || false,
    recurrenceCycle: e.isRecurring ? persistedCycle : undefined,
    recurrenceDays: e.isRecurring && isCustom ? days : undefined,
    isMilestone: e.isMilestone || false,
    milestoneRemindDaysBefore: e.isMilestone
      ? e.milestoneRemindDaysBefore ?? 7
      : undefined,
  } as Omit<FamEvent, "id">;
}
import type { ReminderCategory, ReminderPriority } from "@/types/reminders";

export interface DraftReminder {
  title: string;
  noticeDate: string;
  expiresAfter?: string;
  category?: ReminderCategory;
  emoji?: string;
  childName?: string | null;
  priority?: ReminderPriority;
}

const REMINDER_CATEGORY_EMOJI: Record<string, string> = {
  uniform: "👕",
  bring: "🎒",
  dress_up: "🎩",
  permission: "📝",
  general: "📌",
};

export function normalizeReminder(r: DraftReminder) {
  const category: ReminderCategory = (r.category as ReminderCategory) || "general";
  return {
    title: r.title.trim(),
    noticeDate: r.noticeDate,
    expiresAfter: r.expiresAfter || r.noticeDate,
    category,
    emoji: r.emoji || REMINDER_CATEGORY_EMOJI[category] || "📌",
    childName: r.childName || null,
    childId: null,
    source: "chat" as const,
    priority: (r.priority as ReminderPriority) || "normal",
  };
}
