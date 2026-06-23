import { useEffect, useMemo, useState } from "react";
import type { FamEvent } from "@/types/events";

/** Combine an event's date + time into a JS Date. Events without a time are
 *  treated as 09:00 local so they still sort sensibly within the day. */
function eventDateTime(ev: FamEvent): Date {
  const [y, m, d] = ev.date.split("-").map(Number);
  if (ev.time) {
    const [hh, mm] = ev.time.split(":").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  }
  return new Date(y, (m ?? 1) - 1, d ?? 1, 9, 0, 0, 0);
}

/** Find the next upcoming, not-yet-completed event and produce a live
 *  countdown that ticks every minute. Returns null if nothing is coming up. */
export function useNextEvent(events: FamEvent[]): {
  event: FamEvent | null;
  countdown: string;
} {
  const [now, setNow] = useState(() => new Date());

  // Tick every 30s so the countdown stays fresh without overdoing it.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const event = useMemo<FamEvent | null>(() => {
    const upcoming = events
      .filter((e) => !e.isCompleted)
      .map((e) => ({ ev: e, when: eventDateTime(e) }))
      .filter((x) => x.when.getTime() >= now.getTime())
      .sort((a, b) => a.when.getTime() - b.when.getTime());
    return upcoming[0]?.ev ?? null;
  }, [events, now]);

  const countdown = useMemo(() => {
    if (!event) return "";
    const when = eventDateTime(event);
    const diffMs = when.getTime() - now.getTime();
    if (diffMs < 0) return "now";
    const mins = Math.round(diffMs / 60_000);
    if (mins < 1) return "now";
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs < 24) return remMins > 0 ? `in ${hrs}h ${remMins}m` : `in ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? "tomorrow" : `in ${days}d`;
  }, [event, now]);

  return { event, countdown };
}
