export type EventCategory = "school" | "sports" | "medical" | "social" | "general";
export type RecurrenceCycle = "daily" | "weekly" | "monthly";

export interface FamEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date string
  time?: string;
  category: EventCategory;
  childName?: string;
  emoji?: string;
  isCompleted: boolean;
  isRecurring?: boolean;
  recurrenceCycle?: RecurrenceCycle;
  /** For weekly recurrence: 0=Sun..6=Sat. If empty/undefined, falls back to seed weekday. */
  recurrenceDays?: number[];
  /** Specific occurrence dates (YYYY-MM-DD) to skip when expanding a recurring event. */
  excludedDates?: string[];
  /** Marks this event as a big milestone (concert, exam, reading test, etc). */
  isMilestone?: boolean;
  /** Days before the event to start surfacing reminders/insights. */
  milestoneRemindDaysBefore?: number;
}

export const CATEGORY_CONFIG: Record<EventCategory, { label: string; icon: string; colorClass: string }> = {
  school: { label: "School", icon: "🎒", colorClass: "bg-category-school" },
  sports: { label: "Sports", icon: "⚽", colorClass: "bg-category-sports" },
  medical: { label: "Medical", icon: "🏥", colorClass: "bg-category-medical" },
  social: { label: "Social", icon: "🎉", colorClass: "bg-category-social" },
  general: { label: "General", icon: "📌", colorClass: "bg-category-general" },
};

/** Suggested lead-time (in days) for milestone reminders, by category. */
export const MILESTONE_DEFAULT_DAYS: Record<EventCategory, number> = {
  school: 14,
  sports: 14,
  medical: 3,
  social: 7,
  general: 7,
};

/** Lead-time presets shown in the dialog. */
export const MILESTONE_LEAD_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: "3 days" },
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
  { value: 30, label: "1 month" },
];
