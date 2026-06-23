import { FamEvent } from "@/types/events";
import { format, addDays, addMonths, isAfter, isBefore, parseISO, getDate, getDay, startOfDay } from "date-fns";

const MAX_HORIZON_MONTHS = 12;

/**
 * Expand recurring events into virtual occurrences within [fromDate, toDate].
 * Non-recurring events are passed through unchanged (if within window).
 * Generated occurrences keep the original event id suffixed with `::YYYY-MM-DD`
 * so view-level keys are unique while toggle/delete handlers can recover the seed id.
 */
export function expandRecurringEvents(
  events: FamEvent[],
  fromDate: Date,
  toDate: Date
): FamEvent[] {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  const result: FamEvent[] = [];

  for (const ev of events) {
    const seed = parseISO(ev.date);
    const excluded = new Set(ev.excludedDates || []);

    if (!ev.isRecurring || !ev.recurrenceCycle) {
      // One-off: include if within window
      if (!isBefore(seed, from) && !isAfter(seed, to)) {
        result.push(ev);
      }
      continue;
    }

    // Hard cap forward horizon from seed
    const horizon = addMonths(seed, MAX_HORIZON_MONTHS);
    const windowEnd = isBefore(to, horizon) ? to : horizon;

    if (ev.recurrenceCycle === "daily") {
      let cursor = isBefore(seed, from) ? from : seed;
      // Snap forward to ≥ seed
      if (isBefore(cursor, seed)) cursor = seed;
      while (!isAfter(cursor, windowEnd)) {
        const ds = format(cursor, "yyyy-MM-dd");
        if (!excluded.has(ds)) result.push(occurrence(ev, cursor));
        cursor = addDays(cursor, 1);
      }
    } else if (ev.recurrenceCycle === "weekly") {
      const days = (ev.recurrenceDays && ev.recurrenceDays.length > 0)
        ? [...new Set(ev.recurrenceDays)].sort()
        : [getDay(seed)];
      // Walk day-by-day from max(seed, from) to windowEnd; emit on selected weekdays
      let cursor = isBefore(seed, from) ? from : seed;
      while (!isAfter(cursor, windowEnd)) {
        if (days.includes(getDay(cursor))) {
          const ds = format(cursor, "yyyy-MM-dd");
          if (!excluded.has(ds)) result.push(occurrence(ev, cursor));
        }
        cursor = addDays(cursor, 1);
      }
    } else if (ev.recurrenceCycle === "monthly") {
      const dayOfMonth = getDate(seed);
      let cursor = seed;
      // Fast-forward month-by-month
      while (isBefore(cursor, from)) {
        cursor = addMonths(cursor, 1);
      }
      while (!isAfter(cursor, windowEnd)) {
        // Skip months where day-of-month doesn't exist (e.g. Feb 30)
        if (getDate(cursor) === dayOfMonth) {
          const ds = format(cursor, "yyyy-MM-dd");
          if (!excluded.has(ds)) result.push(occurrence(ev, cursor));
        }
        cursor = addMonths(cursor, 1);
      }
    }
  }

  return result;
}

function occurrence(ev: FamEvent, date: Date): FamEvent {
  const dateStr = format(date, "yyyy-MM-dd");
  if (dateStr === ev.date) return ev;
  return {
    ...ev,
    id: `${ev.id}::${dateStr}`,
    date: dateStr,
  };
}

/** Recover the seed event id from an expanded occurrence id. */
export function getSeedId(occurrenceId: string): string {
  const idx = occurrenceId.indexOf("::");
  return idx === -1 ? occurrenceId : occurrenceId.slice(0, idx);
}

/** Recover the occurrence date from an expanded id, or null if it's not an expansion. */
export function getOccurrenceDate(occurrenceId: string): string | null {
  const idx = occurrenceId.indexOf("::");
  return idx === -1 ? null : occurrenceId.slice(idx + 2);
}
