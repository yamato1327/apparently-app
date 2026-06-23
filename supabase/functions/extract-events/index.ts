import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let { imageBase64, textContent } = await req.json();

    if (!imageBase64 && !textContent) {
      return new Response(
        JSON.stringify({ error: "Either imageBase64 or textContent is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If a PDF data URI is supplied, extract the text and treat it as textContent.
    if (typeof imageBase64 === "string" && imageBase64.startsWith("data:application/pdf")) {
      try {
        const base64 = imageBase64.split(",")[1] ?? "";
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        if (bytes.byteLength > 15 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: "PDF too large (max 15 MB)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        const cleaned = (text || "").trim();
        if (!cleaned) {
          return new Response(
            JSON.stringify({ error: "Could not read any text from this PDF. If it is a scan, upload a screenshot instead.", events: [] }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        textContent = cleaned.slice(0, 40000);
        imageBase64 = undefined;
      } catch (pdfErr) {
        console.error("PDF parse error:", pdfErr);
        return new Response(
          JSON.stringify({ error: "Failed to read PDF contents" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are an assistant that extracts calendar events from images of school notices, sports schedules, party invitations, medical appointments, or any parental commitment.

Extract ALL events you can find. For each event return:
- title: short descriptive title
- description: any extra details (location, what to bring, etc.)
- date: in YYYY-MM-DD format. If the year is not specified, assume the current year or next occurrence. Today is ${today}.
- time: in HH:MM 24-hour format if mentioned, otherwise null
- category: one of "school", "sports", "medical", "social", "general"
- childName: the child's name if mentioned, otherwise null
- emoji: A UNIQUE and SPECIFIC emoji for THIS event. NEVER reuse the same emoji twice in your response.
  Use these guidelines:
  - Music/choir: 🎵🎶🎤🎼🎹🎷🎸
  - Sports: ⚽🏀🏈🏊🏃🤸🏋️🚴🤾🏏🏑🥊🎾🏐
  - School: 📚✏️🎓📝🔬🧪📐🖊️🎒
  - Food/cooking: 🧁🍕🍔🥞🍳🥗🫕🧇
  - Social/parties: 🎉🎊🪩🎈🎁🥳🎠
  - Medical: 💉🩺🏥🦷👁️‍🗨️🧬
  - Arts/craft: 🎨🖌️✂️🧶🪡🎭
  - Swimming: 🏊🤽🩱🏄
  - Dance: 💃🩰🕺
  - Lego/building: 🧱🔧🏗️
  - Clubs: 🌟⭐🎯🏆🎪
  - Reading: 📖📕📗
  - Camp/outdoors: ⛺🏕️🌲🔥🥾🧭
  Be CREATIVE. Each event MUST have a DIFFERENT emoji. Never default to 🍎 or generic icons.

If dates are relative (e.g. "next Tuesday"), resolve them relative to today (${today}).
If you cannot determine a date, use today's date.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageBase64 } },
          {
            type: "text",
            text: "Extract all events from this image. Return them as structured data.",
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Extract all events from this text:\n\n${textContent}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "extract_events",
              description: "Extract calendar events from the provided content",
              parameters: {
                type: "object",
                properties: {
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        date: { type: "string", description: "YYYY-MM-DD format" },
                        time: { type: "string", description: "HH:MM 24-hour format or null" },
                        category: {
                          type: "string",
                          enum: ["school", "sports", "medical", "social", "general"],
                        },
                        childName: { type: "string", description: "Child name or null" },
                        emoji: { type: "string", description: "A single fun emoji representing this specific event" },
                      },
                      required: ["title", "date", "category", "emoji"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["events"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_events" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to process with AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "AI did not return structured events", events: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ events: extracted.events || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-events error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
