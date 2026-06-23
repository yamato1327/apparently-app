import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  text?: string;
  images?: string[]; // base64 data URLs
  childName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const body = (await req.json()) as ReqBody;
    const text = (body.text || "").trim();
    const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
    if (!text && images.length === 0) {
      return new Response(JSON.stringify({ error: "Provide text or images" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `You extract structured meeting summaries from parent-teacher report cards or notes.
Return STRICT JSON: {"overall_notes": string, "focus_areas": [{"area": string, "owner": "Teacher"|"Parent"|"Child"|"All"}]}.
Provide up to 3 focus_areas. Owner = who is responsible to act. Be concise.`;

    const userParts: any[] = [];
    if (text) userParts.push({ type: "text", text: `Child: ${body.childName || "(unknown)"}\n\nNotes:\n${text}` });
    for (const img of images) {
      userParts.push({ type: "image_url", image_url: { url: img } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userParts },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiRes.json();
    const content = json?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { overall_notes: content, focus_areas: [] }; }

    const focus = Array.isArray(parsed.focus_areas) ? parsed.focus_areas.slice(0, 3) : [];
    const result = {
      overall_notes: typeof parsed.overall_notes === "string" ? parsed.overall_notes : "",
      improvement_area_1: focus[0]?.area || null,
      improvement_area_2: focus[1]?.area || null,
      improvement_area_3: focus[2]?.area || null,
      post_focus_1: focus[0]?.area || null,
      post_focus_2: focus[1]?.area || null,
      post_focus_3: focus[2]?.area || null,
      post_owner_1: focus[0]?.owner || null,
      post_owner_2: focus[1]?.owner || null,
      post_owner_3: focus[2]?.owner || null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-meeting error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});