export type ReminderCategory = "uniform" | "bring" | "dress_up" | "permission" | "general";
export type ReminderPriority = "normal" | "high";
export type ReminderSource = "chat" | "manual" | "email";

export interface Reminder {
  id: string;
  childId?: string | null;
  childName?: string | null; // resolved from children list for display
  title: string;
  noticeDate: string;       // YYYY-MM-DD
  expiresAfter: string;     // YYYY-MM-DD (inclusive last visible date)
  category: ReminderCategory;
  emoji?: string | null;
  source: ReminderSource;
  isDismissed: boolean;
  priority: ReminderPriority;
}

export interface DraftReminder {
  title: string;
  noticeDate: string;
  expiresAfter?: string;
  category?: ReminderCategory;
  emoji?: string | null;
  childName?: string | null;
  priority?: ReminderPriority;
}
