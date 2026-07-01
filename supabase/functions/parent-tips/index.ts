import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Allow service-role calls (e.g. from send-insight-emails cron)
    const bearerToken = authHeader?.replace("Bearer ", "") ?? "";
    const isServiceRole = bearerToken === serviceRoleKey;

    if (!isServiceRole) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader ?? "" } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { todayEvents, tomorrowEvents, children, currentHour, milestones } = await req.json();

    const emptySlots = {
      today_morning: [], today_pickup: [], today_evening: [],
      tomorrow_morning: [], tomorrow_pickup: [],
      milestone_focus: [],
    };

    const hasMilestones = Array.isArray(milestones) && milestones.length > 0;
    if ((!todayEvents || todayEvents.length === 0) && (!tomorrowEvents || tomorrowEvents.length === 0) && !hasMilestones) {
      return new Response(
        JSON.stringify(emptySlots),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const today = new Date().toISOString().split("T")[0];
    const childrenContext = children && children.length > 0
      ? `Children in this family: ${children.map((c: any) => `${c.emoji} ${c.name}`).join(", ")}`
      : "No children profiles set up yet.";

    const formatEvents = (evts: any[]) => evts.map((e: any) => {
      let desc = `- ${e.time || "All day"}: "${e.title}"`;
      if (e.childName) desc += ` (for ${e.childName})`;
      if (e.category) desc += ` [${e.category}]`;
      if (e.description) desc += ` — ${e.description}`;
      if (e.isCompleted) desc += ` ✅ DONE`;
      return desc;
    }).join("\n");

    const todayFormatted = formatEvents(todayEvents || []);
    const tomorrowFormatted = formatEvents(tomorrowEvents || []);

    const milestoneFormatted = hasMilestones
      ? milestones.map((m: any) => {
          const days = typeof m.daysUntil === "number" ? m.daysUntil : "?";
          const who = m.childName ? ` for ${m.childName}` : "";
          const cat = m.category ? ` [${m.category}]` : "";
          const desc = m.description ? ` — ${m.description}` : "";
          return `- "${m.title}"${who} on ${m.date} (${days} days away)${cat}${desc}`;
        }).join("\n")
      : "";

    const hour = typeof currentHour === "number" ? currentHour : new Date().getHours();

    // Determine which slots are still relevant based on time
    let slotInstructions = "";
    if (hour < 10) {
      slotInstructions = "Generate all 5 slots: today_morning, today_pickup, today_evening, tomorrow_morning, tomorrow_pickup.";
    } else if (hour < 14) {
      slotInstructions = "Morning is over. Generate: today_pickup (most relevant NOW), today_evening, tomorrow_morning, tomorrow_pickup. Return today_morning as an empty array.";
    } else if (hour < 18) {
      slotInstructions = "Morning and pickup are over. Generate: today_evening (most relevant NOW), tomorrow_morning, tomorrow_pickup. Return today_morning and today_pickup as empty arrays.";
    } else {
      slotInstructions = "The day is winding down. Generate: today_evening (reflect on today), tomorrow_morning (prep for tomorrow), tomorrow_pickup (what's happening tomorrow afternoon). Return today_morning and today_pickup as empty arrays.";
    }

    const prompt = `You are the BRAIN of a family organiser app called "Better Parent Insights". Your mission: help the parent be calmer, more present, more organised, and raise curious, engaged kids.

${childrenContext}

Today is ${today}. The current time is approximately ${hour}:00.

TODAY'S SCHEDULE:
${todayFormatted || "No events today"}

TOMORROW'S SCHEDULE:
${tomorrowFormatted || "Nothing planned tomorrow"}

${hasMilestones ? `🏆 UPCOMING MILESTONES (big events to prepare for):\n${milestoneFormatted}\n` : ""}
TIMING CONTEXT: ${slotInstructions}

STEP 1 — IDENTIFY THE HIGHLIGHT EVENT(S):
Before generating tips, identify the 1-2 BIGGEST / most exciting / most important events. These are events that are special, unusual, or emotionally significant (concerts, excursions, parties, competitions, medical appointments). Reference these across relevant slots.

STEP 2 — Generate insights for the following time slots:

---

🌅 **TODAY_MORNING (Breakfast / School Run)** — 5-8 tips
Purpose: Start the day right. Build excitement about today's HIGHLIGHT events. Make sure NOTHING is forgotten.
Types:
- "must_take": CRITICAL — items each child MUST take. E.g. Library Day → library books, Swimming → swim bag.
- "breakfast_question": Thought-provoking question about today's highlight for a SPECIFIC child.
- "pack_reminder": Other things to pack/prepare.
- "leave_reminder": Leave-by time or logistics.
- "mindset": Calming tip for the PARENT.

---

🚗 **TODAY_PICKUP (After School)** — 4-6 tips
Purpose: Reconnect. Ask SPECIFIC questions about today's HIGHLIGHT events. Brief on afternoon/evening plans.
Types:
- "reconnect_question": Specific question about today's HIGHLIGHT event for a NAMED child.
- "afternoon_brief": What's happening after pickup.
- "snack_tip": Practical snack/fuel tip.
- "mindset": A presence tip.

---

🌙 **TODAY_EVENING (Wind Down)** — 4-6 tips
Purpose: Reflect on today. Connect deeply. Prepare for tomorrow.
Types:
- "reflection_question": Deep question about today's HIGHLIGHT for a NAMED child.
- "tomorrow_prep": Specific prep for tomorrow's events.
- "pack_tomorrow": Pack something specific for tomorrow.
- "bedtime_ritual": Calming ritual suggestion.
- "parent_reflection": Warm reflection for the parent.

---

🌅 **TOMORROW_MORNING** — 4-6 tips
Purpose: Get ready for tomorrow. What needs packing tonight? What's the big event tomorrow?
Types: Same as today_morning but for TOMORROW's events.

---

🚗 **TOMORROW_PICKUP** — 3-5 tips
Purpose: Preview tomorrow afternoon. What questions to ask, what's planned.
Types: Same as today_pickup but for TOMORROW's events.

---

CRITICAL RULES:
- HIGHLIGHT events MUST be referenced across all relevant slots
- ALWAYS use specific child names AND event names from the schedule
- Every question MUST name the child it's for
- Be warm, specific, actionable — NEVER generic ("how was your day" is BANNED)
- Each tip under 25 words
- Only generate tips for slots indicated by the TIMING CONTEXT above
- Return empty arrays for slots that are no longer relevant

${hasMilestones ? `
🏆 MILESTONE_FOCUS — one entry per upcoming milestone listed above.
For EACH milestone, return an object with:
  - "title": the milestone title
  - "emoji": a single relevant emoji
  - "daysUntil": number of days away (use the value provided)
  - "childName": child name (or null)
  - "tips": 3-4 SHORT, concrete daily action tips (under 18 words each), tailored to how far away it is:
      • If 14+ days: long-range prep, big-picture practice, build excitement
      • If 7-13 days: weekly practice plan, gather supplies, talk it up
      • If 3-6 days: daily rehearsal, refine details, manage nerves
      • If 1-2 days: final pack, calm rituals, lay out outfit
      • If 0 days (today): pep talk, be present, celebrate
  Tips should reference the SPECIFIC milestone and child. NEVER generic.
  Example for "Reading Test in 5 days for Emma":
    "Tonight: 10 min sight-word flashcards together — make it a game"
    "Tomorrow morning: read aloud at breakfast, praise effort not speed"
    "Friday: practice with the actual test format, keep it short & fun"
` : ""}`;

    const tipSchema = {
      type: "object",
      properties: {
        emoji: { type: "string", description: "Single relevant emoji" },
        text: { type: "string", description: "The specific tip or question" },
        type: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        childName: { type: "string", description: "Name of the child this is for, or null if for the parent" },
      },
      required: ["emoji", "text", "type", "priority"],
      additionalProperties: false,
    };

    const milestoneSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        emoji: { type: "string" },
        daysUntil: { type: "number" },
        childName: { type: "string" },
        tips: { type: "array", items: { type: "string" } },
      },
      required: ["title", "emoji", "daysUntil", "tips"],
      additionalProperties: false,
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: "You are an emotionally intelligent parenting coach who knows this family's schedule intimately. You help parents be calmer, more present, and better prepared.",
        messages: [
          { role: "user", content: prompt },
        ],
        tools: [
          {
            name: "parent_insights",
            description: "Return structured parent insights for 5 time slots",
            input_schema: {
              type: "object",
              properties: {
                today_morning: { type: "array", items: tipSchema },
                today_pickup: { type: "array", items: tipSchema },
                today_evening: { type: "array", items: tipSchema },
                tomorrow_morning: { type: "array", items: tipSchema },
                tomorrow_pickup: { type: "array", items: tipSchema },
                milestone_focus: { type: "array", items: milestoneSchema },
              },
              required: ["today_morning", "today_pickup", "today_evening", "tomorrow_morning", "tomorrow_pickup", "milestone_focus"],
              additionalProperties: false,
            },
          },
        ],
        tool_choice: { type: "tool", name: "parent_insights" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited", ...emptySlots }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate insights", ...emptySlots }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolUseBlock = data.content?.find((block: any) => block.type === "tool_use");

    if (!toolUseBlock?.input) {
      return new Response(
        JSON.stringify(emptySlots),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = toolUseBlock.input;

    return new Response(
      JSON.stringify({
        today_morning: extracted.today_morning || [],
        today_pickup: extracted.today_pickup || [],
        today_evening: extracted.today_evening || [],
        tomorrow_morning: extracted.tomorrow_morning || [],
        tomorrow_pickup: extracted.tomorrow_pickup || [],
        milestone_focus: extracted.milestone_focus || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parent-tips error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        today_morning: [], today_pickup: [], today_evening: [],
        tomorrow_morning: [], tomorrow_pickup: [], milestone_focus: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
