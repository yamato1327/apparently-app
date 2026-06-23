import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SMART_EMOJI_GUIDE = `Pick the MOST SPECIFIC emoji possible. Decode acronyms first.

Sport codes (never default to ⚽ or 🏈):
- AFL / Aussie Rules / Auskick / footy / Giants / Eagles / Dockers → 🏉
- NRL / rugby league / rugby union → 🏉
- Soccer / round-ball football → ⚽
- NFL / gridiron → 🏈
- Cricket / T-ball → 🏏 / ⚾
- Hockey → 🏑 · Lacrosse → 🥍 · Netball → 🏐 · Basketball → 🏀 · Volleyball → 🏐

Martial arts (never ⚽ or generic):
- BJJ / Jiu-Jitsu / Judo / Karate / Taekwondo / MMA / Kung Fu → 🥋
- Boxing / kickboxing → 🥊 · Fencing → 🤺 · Wrestling → 🤼

Language & cultural schools — use the LANGUAGE'S COUNTRY FLAG, not 📚:
- Swedish school / Swedish class / Sverigeskolan → 🇸🇪
- French → 🇫🇷 · German → 🇩🇪 · Spanish → 🇪🇸 · Italian → 🇮🇹
- Mandarin / Chinese → 🇨🇳 · Japanese → 🇯🇵 · Korean → 🇰🇷
- Greek → 🇬🇷 · Arabic → 🇸🇦 · Hebrew → 🇮🇱 · Hindi → 🇮🇳
- Polish → 🇵🇱 · Vietnamese → 🇻🇳 · Portuguese → 🇵🇹 · Russian → 🇷🇺
- Auslan / sign language → 🤟

Cultural / national days:
- Midsummer / Midsommar → 🌻 · Swedish National Day → 🇸🇪
- ANZAC Day → 🪖 · Australia Day → 🇦🇺 · Western Australia Day → 🦘
- King's Birthday → 👑 · Labour Day → 🛠️ · Easter Monday / Good Friday → 🐣 / ✝️
- Bastille Day → 🇫🇷 · St Patrick's → ☘️ · Diwali → 🪔 · Lunar New Year → 🧧

Music — match the instrument:
- Piano → 🎹 · Guitar → 🎸 · Violin → 🎻 · Drums → 🥁 · Sax → 🎷
- Choir / singing → 🎤 · Band / orchestra → 🎼 · Recorder / flute → 🪈

Dance: Ballet → 🩰 · Hip-hop → 🕺 · Jazz / contemporary → 💃 · Tap → 👞

Aquatics: Swimming → 🏊 · Water polo → 🤽 · Surf / nippers → 🏄 · Sailing → ⛵

Outdoors: Scouts / Cubs / Joeys → 🪢 · Camping → ⛺ · Hiking → 🥾 · Bushwalk → 🌲

Arts & STEM: Art → 🎨 · Pottery → 🏺 · Drama / theatre / soirée → 🎭 · Coding / robotics → 🤖 · Lego → 🧱 · Chess → ♟️ · Science → 🔬

Medical: Dentist → 🦷 · Optometrist → 👓 · Physio → 🦵 · GP → 🩺 · Vaccination → 💉 · Speech therapy → 🗣️ · OT → ✋

School life: Term starts → 🏫 · Term ends → 🎉 · Assembly → 🏫 · Excursion → 🚌 · Library → 📚 · Sports day → 🏅 · Book week → 📖 · Photo day → 📸 · Crazy hair day → 💇 · Pyjama day → 🦄 · Performance / recital / soirée → 🎭

Social: Birthday → 🎂 · Party → 🎉 · Playdate → 🧸 · Sleepover → 🛌

Rules:
1. Decode acronyms BEFORE picking. AFL is footy = 🏉 (never ⚽).
2. Specificity beats uniqueness — two BJJ classes both get 🥋.
3. Language schools get the flag, not 📚 or 🏫.
4. Performances / recitals / soirées get 🎭, not 🎉.`;

interface EventRow {
  id: string;
  title: string;
  category: string;
}

interface ReminderRow {
  id: string;
  title: string;
  category: string;
}

const REMINDER_CATEGORY_EMOJI: Record<string, string> = {
  uniform: "👕",
  bring: "🎒",
  dress_up: "🎩",
  permission: "📝",
  general: "📌",
};

const MILESTONE_LEAD_DAYS: Record<string, number> = {
  school: 14,
  sports: 14,
  medical: 3,
  social: 7,
  general: 7,
};

/**
 * Hard-coded shortcuts for the most common events. Applied BEFORE calling the AI
 * so obvious cases (Swedish School → 🇸🇪, AFL → 🏉, BJJ → 🥋) get fixed even if
 * the AI gateway is unavailable or rate-limited. Order matters: more specific
 * patterns first.
 */
const KEYWORD_SHORTCUTS: Array<{ pattern: RegExp; emoji: string }> = [
  // Language schools — flag of the language's country
  { pattern: /\bswedish\b|\bsverigeskolan\b|\bsvenska\b/i, emoji: "🇸🇪" },
  { pattern: /\bfrench\b|\bfran[cç]ais\b/i, emoji: "🇫🇷" },
  { pattern: /\bgerman\b|\bdeutsch\b/i, emoji: "🇩🇪" },
  { pattern: /\bspanish\b|\bespa[nñ]ol\b/i, emoji: "🇪🇸" },
  { pattern: /\bitalian\b|\bitaliano\b/i, emoji: "🇮🇹" },
  { pattern: /\b(mandarin|chinese)\b|\b中文\b/i, emoji: "🇨🇳" },
  { pattern: /\bjapanese\b|\b日本語\b/i, emoji: "🇯🇵" },
  { pattern: /\bkorean\b/i, emoji: "🇰🇷" },
  { pattern: /\bgreek\b/i, emoji: "🇬🇷" },
  { pattern: /\barabic\b/i, emoji: "🇸🇦" },
  { pattern: /\bhebrew\b/i, emoji: "🇮🇱" },
  { pattern: /\bhindi\b/i, emoji: "🇮🇳" },
  { pattern: /\bpolish\b/i, emoji: "🇵🇱" },
  { pattern: /\bvietnamese\b/i, emoji: "🇻🇳" },
  { pattern: /\bportuguese\b/i, emoji: "🇵🇹" },
  { pattern: /\brussian\b/i, emoji: "🇷🇺" },
  // Sport codes (decode acronyms BEFORE generic football)
  { pattern: /\bafl\b|\baussie rules\b|\bauskick\b|\bfooty\b|\bdockers\b|\beagles\b|\bgiants\b/i, emoji: "🏉" },
  { pattern: /\bnrl\b|\brugby\b/i, emoji: "🏉" },
  { pattern: /\bnfl\b|\bgridiron\b/i, emoji: "🏈" },
  { pattern: /\bsoccer\b/i, emoji: "⚽" },
  { pattern: /\bcricket\b/i, emoji: "🏏" },
  { pattern: /\bnetball\b/i, emoji: "🏐" },
  { pattern: /\bbasketball\b/i, emoji: "🏀" },
  { pattern: /\bvolleyball\b/i, emoji: "🏐" },
  { pattern: /\bhockey\b/i, emoji: "🏑" },
  { pattern: /\blacrosse\b/i, emoji: "🥍" },
  // Martial arts
  { pattern: /\bbjj\b|\bjiu.?jitsu\b|\bjudo\b|\bkarate\b|\btae.?kwon.?do\b|\bmma\b|\bkung.?fu\b/i, emoji: "🥋" },
  { pattern: /\bboxing\b|\bkickboxing\b/i, emoji: "🥊" },
  { pattern: /\bfencing\b/i, emoji: "🤺" },
  { pattern: /\bwrestling\b/i, emoji: "🤼" },
  // Music
  { pattern: /\bpiano\b/i, emoji: "🎹" },
  { pattern: /\bguitar\b/i, emoji: "🎸" },
  { pattern: /\bviolin\b/i, emoji: "🎻" },
  { pattern: /\bdrum(s|ming)?\b/i, emoji: "🥁" },
  { pattern: /\bsax(ophone)?\b/i, emoji: "🎷" },
  { pattern: /\b(choir|singing|vocal)\b/i, emoji: "🎤" },
  { pattern: /\b(orchestra|band practice|ensemble)\b/i, emoji: "🎼" },
  { pattern: /\b(recorder|flute)\b/i, emoji: "🪈" },
  // Dance
  { pattern: /\bballet\b/i, emoji: "🩰" },
  { pattern: /\bhip.?hop\b/i, emoji: "🕺" },
  { pattern: /\b(jazz dance|contemporary dance)\b/i, emoji: "💃" },
  { pattern: /\btap (class|dance)\b/i, emoji: "👞" },
  // Aquatics & outdoors
  { pattern: /\bswim(ming)?\b/i, emoji: "🏊" },
  { pattern: /\bwater polo\b/i, emoji: "🤽" },
  { pattern: /\b(surf|nippers)\b/i, emoji: "🏄" },
  { pattern: /\bsailing\b/i, emoji: "⛵" },
  { pattern: /\b(scouts|cubs|joeys)\b/i, emoji: "🪢" },
  { pattern: /\b(camping|camp)\b/i, emoji: "⛺" },
  { pattern: /\b(hiking|bushwalk)\b/i, emoji: "🥾" },
  // Arts & STEM
  { pattern: /\bpottery\b/i, emoji: "🏺" },
  { pattern: /\b(drama|theatre|theater|soir[eé]e|recital|performance)\b/i, emoji: "🎭" },
  { pattern: /\b(coding|robotics)\b/i, emoji: "🤖" },
  { pattern: /\blego\b/i, emoji: "🧱" },
  { pattern: /\bchess\b/i, emoji: "♟️" },
  { pattern: /\bscience\b/i, emoji: "🔬" },
  { pattern: /\bart class\b|\bart lesson\b/i, emoji: "🎨" },
  // Medical
  { pattern: /\bdentist\b|\bdental\b/i, emoji: "🦷" },
  { pattern: /\b(optometrist|optom|eye test)\b/i, emoji: "👓" },
  { pattern: /\bphysio\b/i, emoji: "🦵" },
  { pattern: /\b(vaccine|vaccination|immunisation|immunization)\b/i, emoji: "💉" },
  { pattern: /\bspeech (therapy|path)\b/i, emoji: "🗣️" },
  // School life
  { pattern: /\bterm starts?\b|\bfirst day (back|of term)\b/i, emoji: "🏫" },
  { pattern: /\bterm ends?\b|\blast day of term\b/i, emoji: "🎉" },
  { pattern: /\bassembly\b/i, emoji: "🏫" },
  { pattern: /\bexcursion\b/i, emoji: "🚌" },
  { pattern: /\b(library)\b/i, emoji: "📚" },
  { pattern: /\bsports day\b/i, emoji: "🏅" },
  { pattern: /\bbook week\b/i, emoji: "📖" },
  { pattern: /\bphoto day\b/i, emoji: "📸" },
  { pattern: /\bcrazy hair\b/i, emoji: "💇" },
  { pattern: /\bpyjama day\b|\bpajama day\b/i, emoji: "🦄" },
  // Social
  { pattern: /\bbirthday\b/i, emoji: "🎂" },
  { pattern: /\bplaydate\b/i, emoji: "🧸" },
  { pattern: /\bsleepover\b/i, emoji: "🛌" },
  // Holidays
  { pattern: /\bmidsommar\b|\bmidsummer\b/i, emoji: "🌻" },
  { pattern: /\banzac\b/i, emoji: "🪖" },
  { pattern: /\baustralia day\b/i, emoji: "🇦🇺" },
  { pattern: /\bwestern australia day\b|\bwa day\b/i, emoji: "🦘" },
  { pattern: /\b(king'?s|queen'?s) birthday\b/i, emoji: "👑" },
  { pattern: /\b(easter monday|good friday)\b/i, emoji: "🐣" },
  { pattern: /\bdiwali\b/i, emoji: "🪔" },
  { pattern: /\b(lunar new year|chinese new year)\b/i, emoji: "🧧" },
];

function shortcutEmoji(title: string): string | null {
  for (const { pattern, emoji } of KEYWORD_SHORTCUTS) {
    if (pattern.test(title)) return emoji;
  }
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function callGateway(body: unknown, apiKey: string): Promise<Response> {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function pickEmojis(
  events: EventRow[],
  apiKey: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const batch of chunk(events, 30)) {
    const list = batch
      .map((e, i) => `${i + 1}. "${e.title}" (category: ${e.category})`)
      .join("\n");
    const resp = await callGateway(
      {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You assign smart emojis to family-calendar events.\n\n${SMART_EMOJI_GUIDE}` },
          { role: "user", content: `Assign one emoji per event:\n${list}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "assign_emojis",
              description: "Assign smart emojis to events",
              parameters: {
                type: "object",
                properties: {
                  assignments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        emoji: { type: "string" },
                      },
                      required: ["index", "emoji"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["assignments"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "assign_emojis" } },
      },
      apiKey,
    );
    if (!resp.ok) {
      console.error("emoji batch failed", resp.status, await resp.text());
      continue;
    }
    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) continue;
    let parsed: { assignments?: Array<{ index: number; emoji: string }> };
    try {
      parsed = JSON.parse(tc.function.arguments);
    } catch {
      continue;
    }
    for (const a of parsed.assignments ?? []) {
      const ev = batch[a.index - 1];
      if (ev && a.emoji) result[ev.id] = a.emoji;
    }
  }
  return result;
}

async function pickMilestones(
  events: Array<EventRow & { date: string; is_recurring: boolean }>,
  apiKey: string,
): Promise<Set<string>> {
  const flagged = new Set<string>();
  // Skip recurring events — milestones should be one-off occasions.
  const candidates = events.filter((e) => !e.is_recurring);
  for (const batch of chunk(candidates, 40)) {
    const list = batch
      .map((e, i) => `${i + 1}. "${e.title}" (${e.category}, ${e.date})`)
      .join("\n");
    const resp = await callGateway(
      {
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You identify which family-calendar events are MILESTONES — big one-off occasions a parent prepares for in advance.

Milestone YES:
- Performances, concerts, recitals, soirées, plays
- Big games, finals, grand finals, tournaments, carnivals
- Exams, NAPLAN, tests, assessments
- Parent-teacher meetings / interviews
- Graduations, presentations, prize-giving
- Birthdays, big trips, family weddings
- Term starts (first day back), school photo day, book week parade
- Anything titled "Big …" / "First …" / "Final …" / "Grand …"

Milestone NO:
- Regular weekly training/lessons (already excluded — recurring rows skipped)
- Public holidays the parent doesn't actively prepare for (ANZAC Day, Labour Day)
- Routine appointments (regular GP, regular dentist check-up)
- Generic "Term ends" days

Return ONLY the indices of events that are milestones.`,
          },
          { role: "user", content: `Identify milestones:\n${list}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "flag_milestones",
              description: "Return indices of events that are milestones",
              parameters: {
                type: "object",
                properties: {
                  milestone_indices: {
                    type: "array",
                    items: { type: "number" },
                  },
                },
                required: ["milestone_indices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "flag_milestones" } },
      },
      apiKey,
    );
    if (!resp.ok) {
      console.error("milestone batch failed", resp.status, await resp.text());
      continue;
    }
    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) continue;
    let parsed: { milestone_indices?: number[] };
    try {
      parsed = JSON.parse(tc.function.arguments);
    } catch {
      continue;
    }
    for (const idx of parsed.milestone_indices ?? []) {
      const ev = batch[idx - 1];
      if (ev) flagged.add(ev.id);
    }
  }
  return flagged;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !anonKey || !apiKey) {
      throw new Error("Missing required env vars");
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as { mode?: string };
    const mode = body.mode ?? "emojis";

    if (mode === "emojis" || mode === "rescore") {
      // Events missing emoji
      const { data: rawEvents, error: evErr } = await supabase
        .from("events")
        .select("id, title, category, emoji")
        .eq("user_id", userId);
      if (evErr) throw evErr;
      // In "emojis" mode only fill empty rows (idempotent first run).
      // In "rescore" mode re-evaluate ALL rows so wrong emojis (like 🎒 for
      // Swedish School) get corrected.
      const eventsToFix = (rawEvents ?? []).filter((r: any) =>
        mode === "rescore" ? true : !r.emoji || r.emoji.trim() === "",
      ) as EventRow[];

      // Reminders missing emoji
      const { data: rawReminders } = await supabase
        .from("reminders" as any)
        .select("id, title, category, emoji")
        .eq("user_id", userId);
      const remindersToFix = ((rawReminders ?? []) as any[]).filter(
        (r) => !r.emoji || r.emoji.trim() === "",
      ) as ReminderRow[];

      let updatedEvents = 0;
      let updatedReminders = 0;
      let shortcutHits = 0;

      if (eventsToFix.length > 0) {
        // 1) Apply hard-coded keyword shortcuts first (fast, deterministic).
        const shortcutMap: Record<string, string> = {};
        const aiCandidates: EventRow[] = [];
        for (const ev of eventsToFix) {
          const sc = shortcutEmoji(ev.title);
          if (sc) {
            shortcutMap[ev.id] = sc;
            shortcutHits++;
          } else {
            aiCandidates.push(ev);
          }
        }
        // 2) Use AI for the rest.
        const aiMap = aiCandidates.length > 0 ? await pickEmojis(aiCandidates, apiKey) : {};
        const finalMap = { ...aiMap, ...shortcutMap }; // shortcuts win
        for (const [id, emoji] of Object.entries(finalMap)) {
          const { error } = await supabase
            .from("events")
            .update({ emoji })
            .eq("id", id)
            .eq("user_id", userId);
          if (!error) updatedEvents++;
        }
      }

      // Reminders use the fixed category map (no AI needed)
      for (const r of remindersToFix) {
        const emoji = REMINDER_CATEGORY_EMOJI[r.category] || "📌";
        const { error } = await supabase
          .from("reminders" as any)
          .update({ emoji })
          .eq("id", r.id)
          .eq("user_id", userId);
        if (!error) updatedReminders++;
      }

      // Stamp the profile so the auto-runner doesn't fire again.
      await supabase
        .from("profiles")
        .update({ emoji_backfill_at: new Date().toISOString() } as never)
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({
          mode,
          eventsScanned: rawEvents?.length ?? 0,
          eventsUpdated: updatedEvents,
          shortcutHits,
          remindersUpdated: updatedReminders,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "milestones") {
      const { data: rawEvents, error: evErr } = await supabase
        .from("events")
        .select("id, title, category, date, is_recurring, is_milestone")
        .eq("user_id", userId)
        .gte("date", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10))
        .eq("is_milestone", false);
      if (evErr) throw evErr;
      const candidates = (rawEvents ?? []) as Array<
        EventRow & { date: string; is_recurring: boolean }
      >;
      let flaggedCount = 0;
      if (candidates.length > 0) {
        const flagged = await pickMilestones(candidates, apiKey);
        for (const id of flagged) {
          const ev = candidates.find((e) => e.id === id);
          if (!ev) continue;
          const lead = MILESTONE_LEAD_DAYS[ev.category] ?? 7;
          const { error } = await supabase
            .from("events")
            .update({ is_milestone: true, milestone_remind_days_before: lead })
            .eq("id", id)
            .eq("user_id", userId);
          if (!error) flaggedCount++;
        }
      }
      return new Response(
        JSON.stringify({
          mode,
          eventsScanned: candidates.length,
          milestonesFlagged: flaggedCount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backfill-event-emojis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});