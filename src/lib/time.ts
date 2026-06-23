/**
 * Format an "HH:mm" time string into the user's locale-preferred format
 * (12h with am/pm in en-US, 24h in most of EU/AU, etc.) using Intl.
 *
 * Times are wall-clock (no date attached); the user's local timezone is
 * implied by the browser locale. Returns "" if the string can't be parsed.
 */
export function formatEventTime(time: string | null | undefined): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const d = new Date();
  d.setHours(h, m, 0, 0);
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return time;
  }
}

/** The IANA timezone the browser is currently using (e.g. "Australia/Perth"). */
export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Short timezone abbreviation for the user (e.g. "AWST", "GMT+8"). */
export function getLocalTimeZoneAbbr(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
      hour: "numeric",
    }).formatToParts(new Date());
    const tz = parts.find((p) => p.type === "timeZoneName");
    return tz?.value || "";
  } catch {
    return "";
  }
}