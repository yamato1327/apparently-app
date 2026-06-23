import { FamEvent } from "@/types/events";
import type { DraftEvent } from "@/lib/normalizeDraft";
import { parseISO, getDay } from "date-fns";

export type SimilarityReason = "exact" | "recurring-match" | "fuzzy-title";

export interface SimilarMatch {
  event: FamEvent;
  reason: SimilarityReason;
  /** Soft = different child assigned, surface as a hint not a hard duplicate. */
  soft?: boolean;
}

/** Strip emojis, lowercase, drop punctuation, collapse whitespace. */
export function normalizeTitle(t: string): string {
  if (!t) return "";
  return t
    // strip extended pictographic / emoji ranges
    .replace(/\p{Extended_Pictographic}/gu, "")
    .toLowerCase()
    // strip punctuation
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap fuzzy: equal, or one contains the other (after normalization), once both ≥ 4 chars. */
function titlesAreSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length < 4 || nb.length < 4) return false;
  // substring (handles "breakfast club" vs "breakfast club ☕ — yr3")
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

/** Does a recurring event cover this date according to its rule? */
function recurringCoversDate(ev: FamEvent, dateISO: string): boolean {
  if (!ev.isRecurring || !ev.recurrenceCycle) return false;
  const seed = parseISO(ev.date);
  const target = parseISO(dateISO);
  if (target.getTime() < seed.getTime()) return false;
  if ((ev.excludedDates || []).includes(dateISO)) return false;

  if (ev.recurrenceCycle === "daily") return true;
  if (ev.recurrenceCycle === "weekly") {
    const days = (ev.recurrenceDays && ev.recurrenceDays.length > 0)
      ? ev.recurrenceDays
      : [getDay(seed)];
    return days.includes(getDay(target));
  }
  if (ev.recurrenceCycle === "monthly") {
    return seed.getDate() === target.getDate();
  }
  return false;
}

/**
 * Find existing events that look like this draft.
 * Order: exact (same title+date) > recurring-match > fuzzy-title.
 */
export function findSimilarEvents(
  draft: DraftEvent,
  existing: FamEvent[]
): SimilarMatch[] {
  const matches: SimilarMatch[] = [];
  const seen = new Set<string>();

  for (const ev of existing) {
    if (seen.has(ev.id)) continue;
    const titleHit = titlesAreSimilar(ev.title, draft.title);
    if (!titleHit) continue;

    const draftChild = (draft.childName || "").trim().toLowerCase();
    const evChild = (ev.childName || "").trim().toLowerCase();
    const childConflict =
      draftChild && evChild && draftChild !== evChild;

    let reason: SimilarityReason | null = null;

    if (ev.date === draft.date) {
      reason = "exact";
    } else if (recurringCoversDate(ev, draft.date)) {
      reason = "recurring-match";
    } else if (ev.isRecurring) {
      // Title matches an existing recurring event — likely the same series, just a new mention.
      reason = "fuzzy-title";
    } else if (normalizeTitle(ev.title) === normalizeTitle(draft.title)) {
      // Strong title equality on a one-off is worth flagging too.
      reason = "fuzzy-title";
    }

    if (!reason) continue;
    matches.push({ event: ev, reason, soft: !!childConflict });
    seen.add(ev.id);
  }

  // Surface highest-confidence match first
  const rank: Record<SimilarityReason, number> = {
    "exact": 0,
    "recurring-match": 1,
    "fuzzy-title": 2,
  };
  matches.sort((a, b) => rank[a.reason] - rank[b.reason]);
  return matches;
}

export function describeMatch(m: SimilarMatch): string {
  const cycle = m.event.recurrenceCycle;
  const recurringSuffix = m.event.isRecurring && cycle ? ` (repeats ${cycle})` : "";
  switch (m.reason) {
    case "exact":
      return `Already on your calendar on ${m.event.date}${recurringSuffix}`;
    case "recurring-match":
      return `Covered by recurring "${m.event.title.trim()}"${recurringSuffix}`;
    case "fuzzy-title":
      return m.event.isRecurring
        ? `You already have a recurring "${m.event.title.trim()}"${recurringSuffix}`
        : `Looks similar to "${m.event.title.trim()}" on ${m.event.date}`;
  }
}