import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChildren } from "@/hooks/useChildren";
import { toast } from "sonner";
import type { Reminder, ReminderCategory, ReminderPriority, ReminderSource } from "@/types/reminders";

interface DbReminder {
  id: string;
  user_id: string;
  child_id: string | null;
  title: string;
  notice_date: string;
  expires_after: string;
  category: string;
  emoji: string | null;
  source: string;
  is_dismissed: boolean;
  priority: string;
}

const mapRow = (r: DbReminder, childName?: string | null): Reminder => ({
  id: r.id,
  childId: r.child_id,
  childName: childName ?? null,
  title: r.title,
  noticeDate: r.notice_date,
  expiresAfter: r.expires_after,
  category: (r.category as ReminderCategory) ?? "general",
  emoji: r.emoji,
  source: (r.source as ReminderSource) ?? "manual",
  isDismissed: !!r.is_dismissed,
  priority: (r.priority as ReminderPriority) ?? "normal",
});

export function useReminders() {
  const { user } = useAuth();
  const { children: kids } = useChildren();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const instanceIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  );
  const fetchRemindersRef = useRef<() => Promise<void>>(async () => undefined);

  const childNameFor = useCallback(
    (id: string | null) => (id ? kids.find((c) => c.id === id)?.name ?? null : null),
    [kids]
  );

  const fetchReminders = useCallback(async () => {
    if (!user) {
      setReminders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("reminders" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("notice_date", { ascending: true });
    if (error) {
      console.error("fetch reminders error", error);
      toast.error("Failed to load reminders");
    } else {
      setReminders(((data as unknown as DbReminder[] | null) ?? []).map((r) => mapRow(r, childNameFor(r.child_id))));
    }
    setLoading(false);
  }, [user, childNameFor]);

  fetchRemindersRef.current = fetchReminders;

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const channel = supabase
      .channel(`reminders-changes-${user.id}-${instanceIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reminders", filter: `user_id=eq.${user.id}` },
        () => {
          if (active) fetchRemindersRef.current();
        }
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const addReminder = useCallback(
    async (input: Omit<Reminder, "id" | "isDismissed">) => {
      if (!user) return null;
      // Find child id from name if provided
      const matchedChild = input.childName
        ? kids.find((c) => c.name.toLowerCase() === input.childName!.toLowerCase())
        : undefined;
      const row = {
        user_id: user.id,
        child_id: input.childId ?? matchedChild?.id ?? null,
        title: input.title,
        notice_date: input.noticeDate,
        expires_after: input.expiresAfter || input.noticeDate,
        category: input.category || "general",
        emoji: input.emoji ?? null,
        source: input.source || "manual",
        priority: input.priority || "normal",
      };
      const { data, error } = await supabase
        .from("reminders" as any)
        .insert(row)
        .select()
        .single();
      if (error) {
        console.error("add reminder error", error);
        toast.error("Couldn't save reminder");
        return null;
      }
      const created = mapRow(data as unknown as DbReminder, childNameFor((data as unknown as DbReminder).child_id));
      setReminders((prev) => [...prev, created]);
      return created;
    },
    [user, kids, childNameFor]
  );

  const addManyReminders = useCallback(
    async (inputs: Omit<Reminder, "id" | "isDismissed">[]) => {
      if (!user || inputs.length === 0) return;
      const rows = inputs.map((input) => {
        const matchedChild = input.childName
          ? kids.find((c) => c.name.toLowerCase() === input.childName!.toLowerCase())
          : undefined;
        return {
          user_id: user.id,
          child_id: input.childId ?? matchedChild?.id ?? null,
          title: input.title,
          notice_date: input.noticeDate,
          expires_after: input.expiresAfter || input.noticeDate,
          category: input.category || "general",
          emoji: input.emoji ?? null,
          source: input.source || "chat",
          priority: input.priority || "normal",
        };
      });
      const { data, error } = await supabase.from("reminders" as any).insert(rows).select();
      if (error) {
        console.error("bulk add reminders error", error);
        toast.error("Couldn't save reminders");
        return;
      }
      const created = (data as unknown as DbReminder[]).map((r) => mapRow(r, childNameFor(r.child_id)));
      setReminders((prev) => [...prev, ...created]);
    },
    [user, kids, childNameFor]
  );

  const dismissReminder = useCallback(async (id: string) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, isDismissed: true } : r)));
    const { error } = await supabase
      .from("reminders" as any)
      .update({ is_dismissed: true })
      .eq("id", id);
    if (error) {
      console.error("dismiss reminder error", error);
      toast.error("Couldn't dismiss");
      fetchReminders();
    }
  }, [fetchReminders]);

  const deleteReminder = useCallback(async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from("reminders" as any).delete().eq("id", id);
    if (error) {
      console.error("delete reminder error", error);
      toast.error("Couldn't delete");
      fetchReminders();
    }
  }, [fetchReminders]);

  return {
    reminders,
    loading,
    addReminder,
    addManyReminders,
    dismissReminder,
    deleteReminder,
    refresh: fetchReminders,
  };
}
