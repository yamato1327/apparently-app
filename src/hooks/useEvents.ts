import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FamEvent, EventCategory, RecurrenceCycle } from "@/types/events";
import { toast } from "sonner";
import { getSeedId, getOccurrenceDate } from "@/lib/recurrence";

export function useEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  // Run the one-time DB dedup at most once per mount per user.
  const [dedupRan, setDedupRan] = useState(false);

  // Fetch events from DB
  const fetchEvents = useCallback(async () => {
    if (!user) { setEvents([]); setLoading(false); return; }
    
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (error) {
      console.error("Fetch events error:", error);
      toast.error("Failed to load events");
    } else {
      setEvents(
        (data || []).map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description ?? undefined,
          date: e.date,
          time: e.time?.slice(0, 5) ?? undefined,
          category: e.category as EventCategory,
          childName: e.child_name ?? undefined,
          emoji: (e as any).emoji ?? undefined,
          isCompleted: e.is_completed,
          isRecurring: e.is_recurring,
          recurrenceCycle: (e as any).recurrence_cycle as RecurrenceCycle | undefined,
          recurrenceDays: (e as any).recurrence_days ?? undefined,
          excludedDates: (e as any).excluded_dates ?? undefined,
          isMilestone: (e as any).is_milestone ?? false,
          milestoneRemindDaysBefore: (e as any).milestone_remind_days_before ?? undefined,
        }))
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // One-time dedup cleanup: merge DB duplicates (same title+date)
  useEffect(() => {
    if (!user || loading || dedupRan || events.length < 2) return;

    const grouped = new Map<string, FamEvent[]>();
    for (const e of events) {
      const key = `${e.title.trim().toLowerCase()}|${e.date}`;
      const group = grouped.get(key) || [];
      group.push(e);
      grouped.set(key, group);
    }

    const duplicates = [...grouped.values()].filter((g) => g.length > 1);
    if (duplicates.length === 0) {
      setDedupRan(true);
      return;
    }

    const cleanup = async () => {
      setDedupRan(true);
      let mergedCount = 0;
      for (const group of duplicates) {
        // Keep the first, merge & delete the rest
        const [keep, ...rest] = group;
        const descs = group.map((e) => e.description).filter(Boolean);
        const uniqueDescs = [...new Set(descs)];
        const times = group.map((e) => e.time).filter(Boolean).sort();
        const children = group.map((e) => e.childName).filter(Boolean);

        const updates: Record<string, string> = {};
        if (uniqueDescs.length > 0) updates.description = uniqueDescs.join(" | ");
        if (times.length > 0 && times[0] !== keep.time) updates.time = `${times[0]}:00`;
        if (children.length > 0 && !keep.childName) updates.child_name = children[0]!;

        if (Object.keys(updates).length > 0) {
          await supabase.from("events").update(updates as never).eq("id", keep.id);
        }

        const deleteIds = rest.map((e) => e.id);
        await supabase.from("events").delete().in("id", deleteIds);
        mergedCount += deleteIds.length;
      }

      if (mergedCount > 0) {
        toast.success(`🧹 Cleaned up ${mergedCount} duplicate event(s)`);
        fetchEvents(); // Refresh
      }
    };

    cleanup();
  }, [events, user, loading, dedupRan, fetchEvents]);

  // Check for pending events from share handler
  useEffect(() => {
    const check = () => {
      const pending = sessionStorage.getItem("famflow_pending_events");
      if (pending && user) {
        sessionStorage.removeItem("famflow_pending_events");
        try {
          const parsed = JSON.parse(pending) as FamEvent[];
          if (Array.isArray(parsed)) {
            addMultipleEvents(parsed.map(({ id, ...rest }) => rest));
          }
        } catch (err) {
          console.error("Failed to parse pending events:", err);
        }
      }
    };
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [user]);

  const addEvent = useCallback(async (event: Omit<FamEvent, "id">) => {
    if (!user) return;

    // Check for existing duplicate (same title + date, case-insensitive)
    const key = `${event.title.trim().toLowerCase()}|${event.date}`;
    const existingDup = events.find(
      (e) => `${e.title.trim().toLowerCase()}|${e.date}` === key
    );

    if (existingDup) {
      // Merge into existing: update description, keep earliest time, fill child
      const descs = [existingDup.description, event.description].filter(Boolean);
      const mergedDesc = descs.length > 0 ? [...new Set(descs)].join(" | ") : null;
      const mergedTime = existingDup.time && event.time
        ? (event.time < existingDup.time ? event.time : existingDup.time)
        : existingDup.time || event.time;
      const mergedChild = existingDup.childName || event.childName;

      const row: Record<string, unknown> = {};
      if (mergedDesc !== (existingDup.description ?? null)) row.description = mergedDesc;
      if (mergedTime !== existingDup.time) row.time = mergedTime ? `${mergedTime}:00` : null;
      if (mergedChild !== existingDup.childName) row.child_name = mergedChild || null;

      // Preserve recurrence: if new event is recurring (or upgrades cycle), apply it
      let mergedRecurring = existingDup.isRecurring;
      let mergedCycle = existingDup.recurrenceCycle;
      if (event.isRecurring && (!existingDup.isRecurring || existingDup.recurrenceCycle !== event.recurrenceCycle)) {
        mergedRecurring = true;
        mergedCycle = event.recurrenceCycle || existingDup.recurrenceCycle || 'weekly';
        row.is_recurring = true;
        row.recurrence_cycle = mergedCycle;
      }

      if (Object.keys(row).length > 0) {
        await supabase.from("events").update(row as never).eq("id", existingDup.id);
        setEvents((prev) => prev.map((e) =>
          e.id === existingDup.id
            ? { ...e, description: mergedDesc ?? undefined, time: mergedTime, childName: mergedChild, isRecurring: mergedRecurring, recurrenceCycle: mergedCycle }
            : e
        ));
      }

      if (event.isRecurring && mergedRecurring && !existingDup.isRecurring) {
        toast.success(`🔁 Upgraded "${existingDup.title}" to repeat ${mergedCycle || 'weekly'}`);
      } else {
        toast.info(`Merged with existing "${existingDup.title}" on ${event.date}`);
      }
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        user_id: user.id,
        title: event.title,
        description: event.description || null,
        date: event.date,
        time: event.time ? `${event.time}:00` : null,
        category: event.category,
        child_name: event.childName || null,
        emoji: event.emoji || null,
        is_completed: event.isCompleted,
        is_recurring: event.isRecurring || false,
        recurrence_cycle: event.recurrenceCycle || 'weekly',
        recurrence_days: event.recurrenceDays && event.recurrenceDays.length > 0 ? event.recurrenceDays : null,
        is_milestone: event.isMilestone || false,
        milestone_remind_days_before: event.isMilestone ? (event.milestoneRemindDaysBefore ?? 7) : null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      toast.error("Failed to add event");
    } else if (data) {
      setEvents((prev) => [...prev, {
        id: data.id,
        title: data.title,
        description: data.description ?? undefined,
        date: data.date,
        time: data.time?.slice(0, 5) ?? undefined,
        category: data.category as EventCategory,
        childName: data.child_name ?? undefined,
        emoji: (data as any).emoji ?? undefined,
        isCompleted: data.is_completed,
        isRecurring: data.is_recurring,
        recurrenceCycle: (data as any).recurrence_cycle as RecurrenceCycle | undefined,
        recurrenceDays: (data as any).recurrence_days ?? undefined,
        isMilestone: (data as any).is_milestone ?? false,
        milestoneRemindDaysBefore: (data as any).milestone_remind_days_before ?? undefined,
      }]);
      if (data.is_recurring) {
        const cycle = (data as any).recurrence_cycle || 'weekly';
        toast.success(`🔁 Recurring event added — will repeat ${cycle}`);
      }
    }
  }, [user, events]);

  const addMultipleEvents = useCallback(async (newEvents: Omit<FamEvent, "id">[]) => {
    if (!user || newEvents.length === 0) return;

    // Deduplicate: merge events with same title+date (case-insensitive)
    const deduped = newEvents.reduce<Omit<FamEvent, "id">[]>((acc, evt) => {
      const key = `${evt.title.trim().toLowerCase()}|${evt.date}`;
      const existing = acc.find(
        (e) => `${e.title.trim().toLowerCase()}|${e.date}` === key
      );
      if (existing) {
        // Merge: combine descriptions, keep earliest time, prefer non-null child
        const descs = [existing.description, evt.description].filter(Boolean);
        existing.description = descs.length > 0 ? descs.join(" | ") : undefined;
        if (!existing.time && evt.time) existing.time = evt.time;
        if (existing.time && evt.time && evt.time < existing.time) existing.time = evt.time;
        if (!existing.childName && evt.childName) existing.childName = evt.childName;
        // Preserve recurrence: if either is recurring, the merged one is too
        if (evt.isRecurring && !existing.isRecurring) {
          existing.isRecurring = true;
          existing.recurrenceCycle = evt.recurrenceCycle || existing.recurrenceCycle || 'weekly';
        }
      } else {
        acc.push({ ...evt });
      }
      return acc;
    }, []);

    // Also check against existing events in state
    const toInsert = deduped.filter((evt) => {
      const key = `${evt.title.trim().toLowerCase()}|${evt.date}`;
      return !events.some(
        (e) => `${e.title.trim().toLowerCase()}|${e.date}` === key
      );
    });

    if (toInsert.length === 0) {
      toast.info("All events already exist — no duplicates added");
      return;
    }

    if (toInsert.length < newEvents.length) {
      toast.info(`Merged ${newEvents.length - toInsert.length} duplicate(s)`);
    }

    const rows = toInsert.map((e) => ({
      user_id: user.id,
      title: e.title,
      description: e.description || null,
      date: e.date,
      time: e.time && e.time !== "null" ? `${e.time}:00` : null,
      category: e.category,
      child_name: e.childName || null,
      emoji: e.emoji || null,
      is_completed: e.isCompleted,
      is_recurring: e.isRecurring || false,
      recurrence_cycle: e.recurrenceCycle || 'weekly',
      recurrence_days: e.recurrenceDays && e.recurrenceDays.length > 0 ? e.recurrenceDays : null,
      is_milestone: e.isMilestone || false,
      milestone_remind_days_before: e.isMilestone ? (e.milestoneRemindDaysBefore ?? 7) : null,
    } as any));

    const { data, error } = await supabase
      .from("events")
      .insert(rows)
      .select();

    if (error) {
      console.error("Bulk insert error:", error);
      toast.error("Failed to add events");
    } else if (data) {
      setEvents((prev) => [
        ...prev,
        ...data.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description ?? undefined,
          date: d.date,
          time: d.time?.slice(0, 5) ?? undefined,
          category: d.category as EventCategory,
          childName: d.child_name ?? undefined,
          emoji: (d as any).emoji ?? undefined,
          isCompleted: d.is_completed,
          isRecurring: d.is_recurring,
          recurrenceCycle: (d as any).recurrence_cycle as RecurrenceCycle | undefined,
          recurrenceDays: (d as any).recurrence_days ?? undefined,
          isMilestone: (d as any).is_milestone ?? false,
          milestoneRemindDaysBefore: (d as any).milestone_remind_days_before ?? undefined,
        })),
      ]);
    }
  }, [user, events]);

  const toggleComplete = useCallback(async (id: string) => {
    const seedId = getSeedId(id);
    const event = events.find((e) => e.id === seedId);
    if (!event) return;

    const { error } = await supabase
      .from("events")
      .update({ is_completed: !event.isCompleted })
      .eq("id", seedId);

    if (error) {
      toast.error("Failed to update event");
    } else {
      setEvents((prev) => prev.map((e) => e.id === seedId ? { ...e, isCompleted: !e.isCompleted } : e));
    }
  }, [events]);

  const deleteEvent = useCallback(async (id: string) => {
    const seedId = getSeedId(id);
    const { error } = await supabase.from("events").delete().eq("id", seedId);
    if (error) {
      toast.error("Failed to delete event");
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== seedId));
    }
  }, []);

  /** Hide a single occurrence of a recurring event by appending its date to excluded_dates. */
  const deleteOccurrence = useCallback(async (occurrenceId: string) => {
    const seedId = getSeedId(occurrenceId);
    const occDate = getOccurrenceDate(occurrenceId);
    if (!occDate) {
      // Not a recurring expansion — fall back to deleting the row.
      const { error } = await supabase.from("events").delete().eq("id", seedId);
      if (error) toast.error("Failed to delete event");
      else setEvents((prev) => prev.filter((e) => e.id !== seedId));
      return;
    }
    const seed = events.find((e) => e.id === seedId);
    if (!seed) return;

    const next = Array.from(new Set([...(seed.excludedDates || []), occDate])).sort();
    const { error } = await supabase
      .from("events")
      .update({ excluded_dates: next } as never)
      .eq("id", seedId);
    if (error) {
      toast.error("Failed to delete this occurrence");
    } else {
      setEvents((prev) => prev.map((e) => (e.id === seedId ? { ...e, excludedDates: next } : e)));
      toast.success("Occurrence removed");
    }
  }, [events]);

  const updateEvent = useCallback(async (id: string, updates: Partial<Omit<FamEvent, "id">>) => {
    const row: Record<string, unknown> = {};
    if (updates.title !== undefined) row.title = updates.title;
    if (updates.description !== undefined) row.description = updates.description || null;
    if (updates.date !== undefined) row.date = updates.date;
    if (updates.time !== undefined) row.time = updates.time ? `${updates.time}:00` : null;
    if (updates.category !== undefined) row.category = updates.category;
    if (updates.childName !== undefined) row.child_name = updates.childName || null;
    if (updates.isRecurring !== undefined) row.is_recurring = updates.isRecurring;
    if (updates.recurrenceCycle !== undefined) row.recurrence_cycle = updates.recurrenceCycle;
    if (updates.recurrenceDays !== undefined) {
      row.recurrence_days = updates.recurrenceDays && updates.recurrenceDays.length > 0 ? updates.recurrenceDays : null;
    }
    if (updates.isMilestone !== undefined) row.is_milestone = updates.isMilestone;
    if (updates.milestoneRemindDaysBefore !== undefined) {
      row.milestone_remind_days_before = updates.milestoneRemindDaysBefore ?? null;
    }

    const { error } = await supabase.from("events").update(row as never).eq("id", id);
    if (error) {
      toast.error("Failed to update event");
    } else {
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e));
    }
  }, []);

  const bulkUpdateEmojis = useCallback(async () => {
    if (!user || events.length === 0) return;

    toast.info("✨ Generating unique emojis for all events...");

    const { data, error } = await supabase.functions.invoke("bulk-emoji", {
      body: { events: events.map((e) => ({ id: e.id, title: e.title, category: e.category })) },
    });

    if (error || !data?.assignments) {
      toast.error("Failed to generate emojis");
      return;
    }

    // Update each event in DB
    const assignments = data.assignments as { id: string; emoji: string }[];
    let updated = 0;
    for (const a of assignments) {
      const { error: updateErr } = await supabase
        .from("events")
        .update({ emoji: a.emoji } as any)
        .eq("id", a.id);
      if (!updateErr) updated++;
    }

    // Update local state
    setEvents((prev) =>
      prev.map((e) => {
        const match = assignments.find((a) => a.id === e.id);
        return match ? { ...e, emoji: match.emoji } : e;
      })
    );

    toast.success(`🎨 Updated emojis on ${updated} events!`);
  }, [user, events]);

  return { events, loading, addEvent, addMultipleEvents, toggleComplete, deleteEvent, deleteOccurrence, updateEvent, bulkUpdateEmojis };
}
