import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface DraftEvent {
  title: string;
  description?: string;
  date: string;
  time?: string | null;
  category: "school" | "sports" | "medical" | "social" | "general";
  childName?: string | null;
  emoji?: string;
  isRecurring?: boolean;
  recurrenceCycle?: "daily" | "weekly" | "monthly";
  recurrenceMode?: "daily" | "weekly" | "custom" | "monthly";
  recurrenceDays?: number[];
  isMilestone?: boolean;
  milestoneRemindDaysBefore?: number;
}

interface DraftReminder {
  title: string;
  noticeDate: string;
  expiresAfter?: string;
  category?: "uniform" | "bring" | "dress_up" | "permission" | "general";
  emoji?: string;
  childName?: string | null;
  priority?: "normal" | "high";
}

const URL_RE = /(https?:\/\/[^\s)]+)/gi;

async function fetchUrlText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 Apparently-Bot" },
      redirect: "follow",
    });
    if (!res.ok) return `[Could not fetch ${url} — status ${res.status}]`;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) {
      return `[Skipped ${url} — content-type ${ct}]`;
    }
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 6000);
  } catch (e) {
    return `[Error fetching ${url}: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

async function expandUrlsInMessages(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role !== "user") {
      out.push(m);
      continue;
    }
    const urls = Array.from(m.content.matchAll(URL_RE)).map((x) => x[1]);
    if (urls.length === 0) {
      out.push(m);
      continue;
    }
    const fetched: string[] = [];
    for (const u of urls.slice(0, 3)) {
      const text = await fetchUrlText(u);
      fetched.push(`\n\n--- Content from ${u} ---\n${text}`);
    }
    out.push({
      role: "user",
      content: m.content + "\n\n[Auto-fetched page content for assistant context]" + fetched.join(""),
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, currentDrafts, currentReminders } = (await req.json()) as {
      messages: ChatMessage[];
      currentDrafts?: DraftEvent[];
      currentReminders?: DraftReminder[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are a friendly conversational assistant inside the Apparently family-calendar app. You help a parent build TWO lists from chat: scheduled EVENTS (with a time/duration) and lightweight REMINDERS (one-line notices with no time — e.g. "Wear sports uniform Friday", "Bring library books Monday", "Casual clothes day — gold coin").

Today is ${today}. The parent may speak naturally — they might paste an email, share a URL, or describe a class schedule. Your job:
1. Ask brief clarifying questions only when essential (e.g. "Which child?", "Which weekdays?", "Which date range?").
2. CLASSIFY each item:
   - **Event**: has (or implies) a time/duration the parent needs to be somewhere or do something at a specific time. (Lessons, appointments, parties, games.)
   - **Reminder**: a notice/heads-up with NO time — "remember to wear/bring/sign". Anything starting with "wear", "bring", "don't forget", "casual day", "library day", "permission slip due", "hat required", uniform changes, dress-up days, gold coin donations.
3. Build/update BOTH lists progressively. ALWAYS return the COMPLETE current list of drafts AND reminders (replace, never append). If the user says "remove the library reminder", return reminders without it.
4. When a URL appears, page text has been auto-fetched and included — use it.

5. Each EVENT draft must include:
   - title (short)
   - description (optional details, location, what to bring)
   - date in YYYY-MM-DD (resolve relative dates against today)
   - time in HH:MM 24h or null
   - category: school | sports | medical | social | general
   - childName: child name or null
   - emoji: a SPECIFIC, UNIQUE emoji per event (no duplicates within the list). Examples: ⚽🏊🎵📚🎨🩺🎉🧱
   - isRecurring: boolean
   - recurrenceMode: daily | weekly | custom | monthly  (use "custom" when only certain weekdays repeat)
   - recurrenceDays: 0-6 (Sun=0..Sat=6) array, REQUIRED when recurrenceMode = custom
   - isMilestone: true for big events the parent is preparing for (exam, recital, concert, big game)
   - milestoneRemindDaysBefore: lead time in days when isMilestone is true (default 7; school/sports 14; medical 3)

6. Each REMINDER must include:
   - title (short, action-style: "Wear sports uniform", "Bring library books", "Casual clothes day - gold coin")
   - noticeDate in YYYY-MM-DD (the day the reminder applies)
   - expiresAfter in YYYY-MM-DD (default = same as noticeDate; longer for multi-day notices like "no hat, no play this week")
   - category: uniform | bring | dress_up | permission | general
   - emoji: 👕 uniform · 🎒 bring · 🎩 dress_up · 📝 permission · 📌 general
   - childName: which child (or null)
   - priority: "high" for permission slips / things with consequences, otherwise "normal"

Tone: warm, brief, no fluff. Use markdown sparingly. If you have everything you need, say so and invite them to confirm.`;

    const expanded = await expandUrlsInMessages(messages);

    const draftNote = currentDrafts && currentDrafts.length > 0
      ? `\n\nCurrent draft EVENTS in the list (modify/keep/remove based on the latest message):\n${JSON.stringify(currentDrafts, null, 2)}`
      : "\n\nNo event drafts yet.";
    const reminderNote = currentReminders && currentReminders.length > 0
      ? `\n\nCurrent draft REMINDERS in the list:\n${JSON.stringify(currentReminders, null, 2)}`
      : "\n\nNo reminder drafts yet.";
    const contextNote = draftNote + reminderNote;

    const aiMessages = [
      { role: "system", content: systemPrompt + contextNote },
      ...expanded,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        tools: [
          {
            type: "function",
            function: {
              name: "reply_with_drafts",
              description: "Reply to the parent and return the complete updated lists of draft calendar events AND reminders.",
              parameters: {
                type: "object",
                properties: {
                  assistantMessage: {
                    type: "string",
                    description: "Conversational reply to the parent (markdown ok). Keep it brief.",
                  },
                  drafts: {
                    type: "array",
                    description: "FULL updated list of draft events (replace previous list).",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        date: { type: "string", description: "YYYY-MM-DD" },
                        time: { type: "string", description: "HH:MM 24h or empty" },
                        category: { type: "string", enum: ["school", "sports", "medical", "social", "general"] },
                        childName: { type: "string" },
                        emoji: { type: "string" },
                        isRecurring: { type: "boolean" },
                        recurrenceMode: { type: "string", enum: ["daily", "weekly", "custom", "monthly"] },
                        recurrenceDays: {
                          type: "array",
                          items: { type: "integer", minimum: 0, maximum: 6 },
                        },
                        isMilestone: { type: "boolean" },
                        milestoneRemindDaysBefore: { type: "integer", minimum: 1, maximum: 90 },
                      },
                      required: ["title", "date", "category", "emoji"],
                      additionalProperties: false,
                    },
                  },
                  reminders: {
                    type: "array",
                    description: "FULL updated list of draft REMINDERS (one-off notices with NO time). Replace previous list.",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        noticeDate: { type: "string", description: "YYYY-MM-DD" },
                        expiresAfter: { type: "string", description: "YYYY-MM-DD" },
                        category: { type: "string", enum: ["uniform", "bring", "dress_up", "permission", "general"] },
                        emoji: { type: "string" },
                        childName: { type: "string" },
                        priority: { type: "string", enum: ["normal", "high"] },
                      },
                      required: ["title", "noticeDate", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["assistantMessage", "drafts", "reminders"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "reply_with_drafts" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to chat with AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const fallbackText = data.choices?.[0]?.message?.content;

    if (!toolCall) {
      return new Response(
        JSON.stringify({
          assistantMessage: fallbackText || "Sorry, I couldn't process that — try again?",
          drafts: currentDrafts || [],
          reminders: currentReminders || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(
      JSON.stringify({
        assistantMessage: parsed.assistantMessage || "",
        drafts: parsed.drafts || [],
        reminders: parsed.reminders || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat-extract-events error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
