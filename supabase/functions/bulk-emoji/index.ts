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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { events } = await req.json();

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ error: "No events provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const eventList = events.map((e: any, i: number) => `${i + 1}. "${e.title}" (category: ${e.category})`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You assign fun, unique emojis to calendar events. Rules:
- Every event MUST get a DIFFERENT emoji — absolutely NO duplicates in your response
- Pick emojis that are specific and fun, matching the event's activity
- Music/choir: 🎵🎶🎤🎼🎹🎷🎸🪘🎻
- Sports: ⚽🏀🏈🏊🏃🤸🏋️🚴🤾🏏🏑🥊🎾🏐🥅🏇
- School: 📚✏️🎓📝🔬🧪📐🖊️🎒📖📕
- Food/cooking: 🧁🍕🍔🥞🍳🥗🫕🧇☕🍩
- Social/parties: 🎉🎊🪩🎈🎁🥳🎠🎪
- Medical: 💉🩺🏥🦷👁️‍🗨️🧬
- Arts/craft: 🎨🖌️✂️🧶🪡🎭🖍️
- Dance: 💃🩰🕺
- Lego/building: 🧱🔧🏗️
- Camp/outdoors: ⛺🏕️🌲🔥🥾🧭
- Swimming: 🏊🤽🩱🏄
- General: 🌟⭐🎯🏆📌🔔✨💡🚀
Return ONLY the JSON array.`,
          },
          {
            role: "user",
            content: `Assign a unique emoji to each event:\n${eventList}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "assign_emojis",
              description: "Assign unique emojis to events",
              parameters: {
                type: "object",
                properties: {
                  assignments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number", description: "1-based event index" },
                        emoji: { type: "string", description: "A single unique emoji" },
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
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Failed to process with AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return assignments", assignments: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Map back to event IDs
    const result = (extracted.assignments || []).map((a: any) => ({
      id: events[a.index - 1]?.id,
      emoji: a.emoji,
    })).filter((r: any) => r.id);

    return new Response(JSON.stringify({ assignments: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("bulk-emoji error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
