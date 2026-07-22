import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Pref {
  user_id: string;
  morning_enabled: boolean;
  morning_time: string;
  night_enabled: boolean;
  night_time: string;
  timezone: string;
  cc_email?: string | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://stay-at-home.lovable.app";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// Returns local "HH:MM" and "YYYY-MM-DD" for a given timezone.
function localParts(tz: string, date = new Date()): { hh: number; mm: number; date: string; hour: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    const hh = Number(parts.hour);
    const mm = Number(parts.minute);
    const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
    return { hh, mm, date: dateStr, hour: hh };
  } catch {
    const hh = date.getUTCHours();
    return { hh, mm: date.getUTCMinutes(), date: date.toISOString().slice(0, 10), hour: hh };
  }
}

// Within a 15-min window (e.g. cron runs every 15min), this returns true if
// the target HH:MM falls within [now, now+15min) in the given timezone.
function isDueNow(tz: string, target: string, windowMin = 15): boolean {
  const { hh, mm } = localParts(tz);
  const [th, tm] = target.split(":").map(Number);
  const nowMin = hh * 60 + mm;
  const targetMin = th * 60 + tm;
  return targetMin >= nowMin && targetMin < nowMin + windowMin;
}

function tomorrowDate(tz: string): string {
  const now = new Date();
  // Add 24h then format in tz — close enough for our purposes
  const t = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return localParts(tz, t).date;
}

// Category -> emoji fallback map (mirrors app categorisation lightly)
const CATEGORY_EMOJI: Record<string, string> = {
  school: "🎒", sport: "⚽", sports: "⚽", swim: "🏊", swimming: "🏊",
  music: "🎵", art: "🎨", health: "🩺", medical: "🩺", dentist: "🦷",
  birthday: "🎂", party: "🎉", playdate: "🧸", family: "🏠", meal: "🍽️",
  reading: "📚", library: "📚", appointment: "📅",
};

function emojiFor(ev: { emoji?: string; category?: string | null; title?: string }): string {
  if ((ev as any).emoji) return (ev as any).emoji as string;
  const cat = (ev.category || "").toLowerCase().trim();
  if (cat && CATEGORY_EMOJI[cat]) return CATEGORY_EMOJI[cat];
  return "✨";
}

function sortAndDedupeEvents(events: any[]): any[] {
  const map = new Map<string, any>();
  for (const e of events) {
    const key = `${(e.title || "").trim().toLowerCase()}|${e.date}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...e });
    } else {
      // keep earliest time
      const a = existing.time, b = e.time;
      if (b && (!a || b < a)) existing.time = b;
      // merge descriptions
      const descs = [existing.description, e.description].filter(Boolean);
      if (descs.length) existing.description = Array.from(new Set(descs)).join(" · ");
      // prefer a non-empty childName
      if (!existing.childName && e.childName) existing.childName = e.childName;
    }
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => {
    const at = a.time || "99:99";
    const bt = b.time || "99:99";
    if (at !== bt) return at < bt ? -1 : 1;
    return (a.title || "").localeCompare(b.title || "");
  });
  return arr;
}

function toCalEvents(events: any[]): any[] {
  return sortAndDedupeEvents(events).map((e) => ({
    id: e.id,
    emoji: emojiFor(e),
    title: e.title,
    time: e.time,
    childName: e.childName,
    description: e.description,
    isCompleted: !!e.isCompleted,
  }));
}

function groupEventsByChild(events: any[], children: any[]): { childName: string; emoji?: string; events: any[] }[] | undefined {
  if (!events.length || children.length < 2) return undefined;
  const byChild = new Map<string, any[]>();
  for (const e of events) {
    const key = e.childName || "Family";
    if (!byChild.has(key)) byChild.set(key, []);
    byChild.get(key)!.push(e);
  }
  // Order: defined children in registry order, then "Family", then unknown
  const ordered: { childName: string; emoji?: string; events: any[] }[] = [];
  for (const c of children) {
    if (byChild.has(c.name)) {
      ordered.push({ childName: c.name, emoji: c.emoji, events: byChild.get(c.name)! });
      byChild.delete(c.name);
    }
  }
  for (const [k, v] of byChild) ordered.push({ childName: k, events: v });
  return ordered;
}

const REMINDER_EMOJI: Record<string, string> = {
  uniform: "👕", bring: "🎒", dress_up: "🎭", permission: "✍️", general: "📌",
};

async function loadRemindersForDate(userId: string, dateStr: string, children: any[]) {
  const { data } = await admin
    .from("reminders")
    .select("title, category, priority, emoji, child_id, notice_date, expires_after, is_dismissed")
    .eq("user_id", userId)
    .eq("is_dismissed", false)
    .lte("notice_date", dateStr)
    .gte("expires_after", dateStr);
  const childMap = new Map<string, any>();
  for (const c of children) childMap.set(c.id, c);
  return (data || []).map((r: any) => ({
    title: r.title,
    category: r.category,
    priority: r.priority,
    emoji: r.emoji || REMINDER_EMOJI[r.category] || "📌",
    childName: r.child_id ? (childMap.get(r.child_id)?.name || null) : null,
  })).sort((a: any, b: any) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    return 0;
  });
}

async function loadChildrenWithIds(userId: string) {
  const { data } = await admin.from("children").select("id, name, emoji").eq("user_id", userId);
  return data || [];
}

async function loadProfileExtended(userId: string) {
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, city, state")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: userResult } = await admin.auth.admin.getUserById(userId);
  return {
    name: profile?.display_name || null,
    email: userResult?.user?.email || null,
    city: profile?.city || null,
    state: profile?.state || null,
  };
}

const WMO_EMOJI: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "❄️", 73: "❄️", 75: "❄️",
  80: "🌦️", 81: "🌧️", 82: "🌧️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};
const WMO_LABEL: Record<number, string> = {
  0: "Clear", 1: "Mostly sunny", 2: "Partly cloudy", 3: "Cloudy",
  45: "Foggy", 48: "Foggy",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Showers", 81: "Showers", 82: "Heavy showers",
  95: "Thunderstorms", 96: "Thunderstorms", 99: "Thunderstorms",
};
const STATE_GEO: Record<string, { lat: number; lon: number; tz: string }> = {
  WA: { lat: -31.95, lon: 115.86, tz: "Australia/Perth" },
  NSW: { lat: -33.87, lon: 151.21, tz: "Australia/Sydney" },
  VIC: { lat: -37.81, lon: 144.96, tz: "Australia/Melbourne" },
  QLD: { lat: -27.47, lon: 153.03, tz: "Australia/Brisbane" },
  SA: { lat: -34.93, lon: 138.6, tz: "Australia/Adelaide" },
  TAS: { lat: -42.88, lon: 147.33, tz: "Australia/Hobart" },
  NT: { lat: -12.46, lon: 130.84, tz: "Australia/Darwin" },
  ACT: { lat: -35.28, lon: 149.13, tz: "Australia/Sydney" },
};

async function loadWeatherForToday(state: string | null): Promise<any | undefined> {
  const geo = (state && STATE_GEO[state]) || STATE_GEO.WA;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=${encodeURIComponent(geo.tz)}&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = await res.json();
    const code = data?.daily?.weather_code?.[0] ?? 0;
    const tMax = Math.round(data?.daily?.temperature_2m_max?.[0] ?? 0);
    const tMin = Math.round(data?.daily?.temperature_2m_min?.[0] ?? 0);
    const summary = WMO_LABEL[code] || "Forecast";
    let hint: string | undefined;
    if ([51,53,55,61,63,65,80,81,82,95,96,99].includes(code)) hint = "Pack a raincoat";
    else if (tMax >= 30) hint = "Hat, water bottle, sunscreen";
    else if (tMax <= 14) hint = "Warm jacket today";
    else if (tMin <= 8) hint = "Layers — chilly start";
    return { emoji: WMO_EMOJI[code] || "🌡️", tempMax: tMax, tempMin: tMin, summary, hint };
  } catch (e) {
    console.error("weather fetch failed", e);
    return undefined;
  }
}

function flatTips(arr: any[] | undefined): { emoji?: string; text: string; childName?: string; type?: string; priority?: string }[] {
  if (!arr) return [];
  return arr.map((t) => ({
    emoji: t.emoji,
    text: t.text,
    childName: t.childName,
    type: t.type,
    priority: t.priority,
  }));
}

function highlightFrom(slots: any): string | undefined {
  const all = [
    ...(slots.today_morning || []),
    ...(slots.today_evening || []),
    ...(slots.tomorrow_morning || []),
  ];
  const high = all.find((t: any) => t.priority === "high" && t.text);
  return high?.text;
}

async function callParentTips(payload: any) {
  const url = `${SUPABASE_URL}/functions/v1/parent-tips`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`parent-tips failed: ${res.status}`);
  return await res.json();
}

async function sendEmail(templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) {
  const { data, error } = await admin.functions.invoke("send-transactional-email", {
    body: { templateName, recipientEmail, idempotencyKey, templateData },
  });
  if (error) throw new Error(error.message);
  return data;
}

async function loadEventsForUser(userId: string, todayStr: string, tomorrowStr: string) {
  const { data: rows } = await admin
    .from("events")
    .select("id, title, description, date, time, category, child_name, is_completed, is_recurring, recurrence_cycle, recurrence_days, excluded_dates")
    .eq("user_id", userId);
  const expanded = expandRecurring(rows || [], todayStr, tomorrowStr);
  const map = (e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date,
    time: e.time ? String(e.time).slice(0, 5) : null,
    category: e.category,
    childName: e.child_name,
    isCompleted: e.is_completed,
  });
  return {
    today: expanded.filter((e: any) => e.date === todayStr).map(map),
    tomorrow: expanded.filter((e: any) => e.date === tomorrowStr).map(map),
  };
}

// --- Recurrence expansion (mirrors src/lib/recurrence.ts) ---
function parseISODate(s: string): Date {
  // Treat as UTC midnight to keep day arithmetic stable
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
function fmtISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDaysUTC(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
function addMonthsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}

function expandRecurring(rows: any[], fromStr: string, toStr: string): any[] {
  const from = parseISODate(fromStr);
  const to = parseISODate(toStr);
  const HORIZON_MONTHS = 12;
  const out: any[] = [];

  for (const ev of rows) {
    const seed = parseISODate(ev.date);
    const excluded = new Set<string>(Array.isArray(ev.excluded_dates) ? ev.excluded_dates : []);

    if (!ev.is_recurring || !ev.recurrence_cycle) {
      if (seed.getTime() >= from.getTime() && seed.getTime() <= to.getTime()) {
        out.push(ev);
      }
      continue;
    }

    const horizon = addMonthsUTC(seed, HORIZON_MONTHS);
    const windowEnd = to.getTime() < horizon.getTime() ? to : horizon;

    if (ev.recurrence_cycle === "daily") {
      let cursor = seed.getTime() < from.getTime() ? from : seed;
      while (cursor.getTime() <= windowEnd.getTime()) {
        const ds = fmtISO(cursor);
        if (!excluded.has(ds)) out.push(occ(ev, ds));
        cursor = addDaysUTC(cursor, 1);
      }
    } else if (ev.recurrence_cycle === "weekly") {
      const days: number[] = (Array.isArray(ev.recurrence_days) && ev.recurrence_days.length > 0)
        ? [...new Set<number>(ev.recurrence_days)].sort()
        : [seed.getUTCDay()];
      let cursor = seed.getTime() < from.getTime() ? from : seed;
      while (cursor.getTime() <= windowEnd.getTime()) {
        if (days.includes(cursor.getUTCDay())) {
          const ds = fmtISO(cursor);
          if (!excluded.has(ds)) out.push(occ(ev, ds));
        }
        cursor = addDaysUTC(cursor, 1);
      }
    } else if (ev.recurrence_cycle === "monthly") {
      const dom = seed.getUTCDate();
      let cursor = seed;
      while (cursor.getTime() < from.getTime()) cursor = addMonthsUTC(cursor, 1);
      while (cursor.getTime() <= windowEnd.getTime()) {
        if (cursor.getUTCDate() === dom) {
          const ds = fmtISO(cursor);
          if (!excluded.has(ds)) out.push(occ(ev, ds));
        }
        cursor = addMonthsUTC(cursor, 1);
      }
    }
  }
  return out;
}

function occ(ev: any, dateStr: string): any {
  if (dateStr === ev.date) return ev;
  return { ...ev, id: `${ev.id}::${dateStr}`, date: dateStr };
}

function buildMorningTemplateData(opts: {
  parentName: string | null;
  dateLabel: string;
  tomorrowLabel: string;
  slots: any;
  todayEvents: any[];
  tomorrowEvents: any[];
  reminders: any[];
  weather: any | undefined;
  children: any[];
  manageUrl: string;
  unsubscribeUrl?: string;
  viewInBrowserUrl: string;
}) {
  const { parentName, dateLabel, tomorrowLabel, slots, todayEvents, tomorrowEvents, reminders, weather, children, manageUrl, unsubscribeUrl, viewInBrowserUrl } = opts;
  const todayMorning = flatTips(slots.today_morning);
  const mustTakes = todayMorning.filter((t) => t.type === "must_take" || t.priority === "high");
  const breakfast = todayMorning.filter((t) => t.type !== "must_take" && t.priority !== "high");
  const todayCal = toCalEvents(todayEvents);
  const childGroups = groupEventsByChild(todayCal, children);
  return {
    parentName,
    dateLabel,
    tomorrowLabel,
    todayHighlight: highlightFrom(slots),
    weather,
    reminders,
    mustTakes,
    morningTips: breakfast,
    pickupTips: flatTips(slots.today_pickup),
    eveningTips: flatTips(slots.today_evening),
    mindsetNote: todayMorning.find((t) => t.type === "mindset")?.text,
    todayEvents: todayCal,
    tomorrowEvents: toCalEvents(tomorrowEvents),
    childGroups,
    manageUrl,
    unsubscribeUrl,
    viewInBrowserUrl,
  };
}

function buildNightTemplateData(opts: {
  parentName: string | null;
  dateLabel: string;
  tomorrowLabel: string;
  slots: any;
  tomorrowEvents: any[];
  todayEvents: any[];
  tomorrowReminders: any[];
  children: any[];
  manageUrl: string;
  unsubscribeUrl?: string;
  viewInBrowserUrl: string;
}) {
  const { parentName, dateLabel, tomorrowLabel, slots, tomorrowEvents, todayEvents, tomorrowReminders, children, manageUrl, unsubscribeUrl, viewInBrowserUrl } = opts;
  const evening = flatTips(slots.today_evening);
  const tomorrowMorning = flatTips(slots.tomorrow_morning);
  const tomorrowCal = toCalEvents(tomorrowEvents);
  const childGroups = groupEventsByChild(tomorrowCal, children);
  const todayTotal = todayEvents.length;
  const todayCompleted = todayEvents.filter((e: any) => e.isCompleted).length;
  return {
    parentName,
    dateLabel,
    tomorrowLabel,
    reflection: evening.find((t) => t.type === "reflection_question")?.text,
    todayRecap: evening.filter((t) => t.type !== "reflection_question" && t.type !== "bedtime_ritual").slice(0, 3),
    todayCompleted,
    todayTotal,
    tomorrowHighlight: highlightFrom({ tomorrow_morning: slots.tomorrow_morning, today_evening: [], today_morning: [] }),
    packTonight: evening.filter((t) => t.type === "pack_tomorrow" || t.type === "tomorrow_prep"),
    tomorrowMorning,
    bedtimeRitual: evening.find((t) => t.type === "bedtime_ritual")?.text,
    tomorrowEvents: tomorrowCal,
    tomorrowReminders,
    childGroups,
    manageUrl,
    unsubscribeUrl,
    viewInBrowserUrl,
  };
}

function dateLabelFor(tz: string, dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
}

async function processOne(pref: Pref, kind: "morning" | "night", forceTodayStr?: string): Promise<{ skipped?: string; sent?: boolean }> {
  const tz = pref.timezone || "Australia/Perth";
  const { date: todayStr } = localParts(tz);
  const today = forceTodayStr || todayStr;
  const tomorrow = tomorrowDate(tz);
  const profile = await loadProfileExtended(pref.user_id);
  if (!profile.email) return { skipped: "no_email" };

  const { today: todayEvents, tomorrow: tomorrowEvents } = await loadEventsForUser(pref.user_id, today, tomorrow);
  const children = await loadChildrenWithIds(pref.user_id);

  // Reminders (today for morning email, tomorrow for night email)
  const reminderDate = kind === "morning" ? today : tomorrow;
  const reminders = await loadRemindersForDate(pref.user_id, reminderDate, children);

  // Skip only if literally nothing to say
  if (todayEvents.length === 0 && tomorrowEvents.length === 0 && reminders.length === 0) {
    return { skipped: "no_content" };
  }

  const weather = kind === "morning" ? await loadWeatherForToday(profile.state) : undefined;
  const currentHour = kind === "morning" ? 7 : 20;

  const emptySlots = { today_morning: [], today_pickup: [], today_evening: [], tomorrow_morning: [], tomorrow_pickup: [], milestone_focus: [] };
  let slots: any = emptySlots;
  try {
    slots = await callParentTips({ todayEvents, tomorrowEvents, children, currentHour });
  } catch (e) {
    console.error("send-insight-emails: parent-tips failed, sending without AI tips", { error: String(e) });
  }

  const dateLabel = dateLabelFor(tz, today);
  const tomorrowLabel = dateLabelFor(tz, tomorrow);
  const templateName = kind === "morning" ? "insight-morning" : "insight-night";
  const manageUrl = `${APP_URL}/profile`;
  const viewInBrowserUrl = APP_URL;
  const templateData = kind === "morning"
    ? buildMorningTemplateData({
        parentName: profile.name, dateLabel, tomorrowLabel, slots,
        todayEvents, tomorrowEvents, reminders, weather, children,
        manageUrl, viewInBrowserUrl,
      })
    : buildNightTemplateData({
        parentName: profile.name, dateLabel, tomorrowLabel, slots,
        tomorrowEvents, todayEvents, tomorrowReminders: reminders, children,
        manageUrl, viewInBrowserUrl,
      });

  const idempotencyKey = `insight-${kind}-${pref.user_id}-${today}`;
  await sendEmail(templateName, profile.email, idempotencyKey, { ...templateData, isCcRecipient: false });

  // CC: send the same rendered email to the secondary address if configured
  if (pref.cc_email) {
    try {
      await sendEmail(templateName, pref.cc_email, `${idempotencyKey}-cc`, { ...templateData, isCcRecipient: true });
    } catch (e) {
      console.error("send-insight-emails cc send failed", { user_id: pref.user_id, cc: pref.cc_email, error: String(e) });
    }
  }

  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // Test send: { test: true, kind: "morning" | "night", userId }
    if (body.test === true && body.userId && (body.kind === "morning" || body.kind === "night")) {
      // Validate caller JWT for test sends (in-code, since verify_jwt = false at gateway)
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        console.error("send-insight-emails test: missing or malformed Authorization header");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: callerUser }, error: claimsErr } = await admin.auth.getUser(token);
      if (claimsErr || !callerUser?.id) {
        console.error("send-insight-emails test: JWT validation failed", { error: claimsErr?.message });
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Force userId to the authenticated caller — never trust client-supplied id
      const callerId = callerUser.id;
      const { data: pref, error: prefError } = await admin
        .from("email_preferences")
        .select("*")
        .eq("user_id", callerId)
        .maybeSingle();
      if (prefError) {
        console.error("send-insight-emails test: email_preferences query failed", { userId: callerId, error: prefError.message, code: prefError.code });
        return new Response(JSON.stringify({ error: "Failed to load preferences", detail: prefError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!pref) {
        console.error("send-insight-emails test: no email_preferences row", { userId: callerId });
        return new Response(JSON.stringify({ error: "No preferences row" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Force send regardless of time
      const result = await processOne(pref as Pref, body.kind);
      return new Response(JSON.stringify({ ok: true, kind: body.kind, result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron invocation: process all due users
    const { data: prefs } = await admin
      .from("email_preferences")
      .select("user_id, morning_enabled, morning_time, night_enabled, night_time, timezone, cc_email");

    const stats = { checked: 0, sent_morning: 0, sent_night: 0, skipped: 0, errors: 0 };

    for (const p of (prefs || []) as Pref[]) {
      stats.checked++;
      try {
        if (p.morning_enabled && isDueNow(p.timezone, String(p.morning_time).slice(0, 5))) {
          const r = await processOne(p, "morning");
          if (r.sent) stats.sent_morning++; else stats.skipped++;
        }
        if (p.night_enabled && isDueNow(p.timezone, String(p.night_time).slice(0, 5))) {
          const r = await processOne(p, "night");
          if (r.sent) stats.sent_night++; else stats.skipped++;
        }
      } catch (e) {
        console.error("send-insight-emails user error", { user_id: p.user_id, error: String(e) });
        stats.errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-insight-emails error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
