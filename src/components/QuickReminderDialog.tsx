import { useState } from "react";
import { X, Bell, Loader2 } from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { useChildren } from "@/hooks/useChildren";
import { toast } from "sonner";
import type { ReminderCategory, ReminderPriority } from "@/types/reminders";

interface QuickReminderDialogProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: { value: ReminderCategory; label: string; emoji: string }[] = [
  { value: "uniform", label: "Uniform", emoji: "👕" },
  { value: "bring", label: "Bring", emoji: "🎒" },
  { value: "dress_up", label: "Dress-up", emoji: "🎩" },
  { value: "permission", label: "Permission", emoji: "📝" },
  { value: "general", label: "General", emoji: "📌" },
];

const QuickReminderDialog = ({ open, onClose }: QuickReminderDialogProps) => {
  const { addReminder } = useReminders();
  const { children } = useChildren();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState<ReminderCategory>("general");
  const [childName, setChildName] = useState<string>("");
  const [priority, setPriority] = useState<ReminderPriority>("normal");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setTitle("");
    setDate(new Date().toISOString().split("T")[0]);
    setCategory("general");
    setChildName("");
    setPriority("normal");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Add a short title for the reminder");
      return;
    }
    setSaving(true);
    const cat = CATEGORIES.find((c) => c.value === category);
    const created = await addReminder({
      title: title.trim(),
      noticeDate: date,
      expiresAfter: date, // default: hide after the day
      category,
      emoji: cat?.emoji,
      childName: childName || null,
      childId: null,
      source: "manual",
      priority,
    });
    setSaving(false);
    if (created) {
      toast.success("Reminder added 🔔");
      reset();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card border shadow-card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-bold font-display text-foreground">Quick Reminder</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              What's the reminder?
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wear sports uniform"
              autoFocus
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                For
              </label>
              <select
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Anyone</option>
                {children.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.emoji || "👦"} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    category === c.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={priority === "high"}
                onChange={(e) => setPriority(e.target.checked ? "high" : "normal")}
                className="rounded border-border"
              />
              Mark as high priority (important — like permission slips)
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border bg-background py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
              Save reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickReminderDialog;
