import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  image: string; // base64 data URL
  childName?: string;
  childAge?: number | null;
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
    if (!body?.image) {
      return new Response(JSON.stringify({ error: "image is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ageHint = body.childAge ? `${body.childName || "the child"} is ${body.childAge}` : (body.childName || "the child");

    const sys = `You help a parent have a great conversation about a book their child is reading.
You are given a photo (the book cover, a page, or the child holding the book).
Identify the book title if visible. Then craft 3 short, warm conversation questions for the parent to ask:
- Question 1: about the COVER, ILLUSTRATION, OR TITLE visible in the photo (be specific to what you see).
- Question 2: a generic comprehension question (favourite character / part / why).
- Question 3: a generic reflection question (feelings / personal connection / what it reminded them of).
Keep questions kid-friendly and ${ageHint ? `appropriate for ${ageHint}` : "age-appropriate"}.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify the book and produce the 3 questions." },
              { type: "image_url", image_url: { url: body.image } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "reading_questions",
            description: "Return book title and 3 conversation questions",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Detected book title, or empty if unknown" },
                question_1: { type: "string" },
                question_2: { type: "string" },
                question_3: { type: "string" },
              },
              required: ["title", "question_1", "question_2", "question_3"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "reading_questions" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502;
      const msg = aiRes.status === 429 ? "Rate limit exceeded, please try again shortly."
        : aiRes.status === 402 ? "AI credits exhausted. Add credits in Workspace settings."
        : "AI request failed";
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiRes.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try { parsed = typeof args === "string" ? JSON.parse(args) : (args || {}); } catch { parsed = {}; }

    // Try to fetch a professional cover image from Open Library / Google Books using the title.
    let cover_url = "";
    const title: string = (parsed.title || "").trim();
    if (title) {
      try {
        const ol = await fetch(
          `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`
        );
        if (ol.ok) {
          const olJson: any = await ol.json();
          const doc = olJson?.docs?.[0];
          if (doc?.cover_i) {
            cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          } else if (doc?.isbn?.[0]) {
            cover_url = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
          }
        }
      } catch (e) { console.warn("openlibrary lookup failed", e); }

      if (!cover_url) {
        try {
          const gb = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1&printType=books`
          );
          if (gb.ok) {
            const gbJson: any = await gb.json();
            const img = gbJson?.items?.[0]?.volumeInfo?.imageLinks;
            const raw = img?.extraLarge || img?.large || img?.medium || img?.thumbnail || img?.smallThumbnail || "";
            if (raw) cover_url = String(raw).replace(/^http:\/\//, "https://");
          }
        } catch (e) { console.warn("google books lookup failed", e); }
      }
    }

    return new Response(JSON.stringify({
      title: parsed.title || "",
      question_1: parsed.question_1 || "",
      question_2: parsed.question_2 || "",
      question_3: parsed.question_3 || "",
      cover_url,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("extract-book error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});