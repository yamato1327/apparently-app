import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  image: string; // base64 data URL
  childName?: string;
  childAge?: number | null;
  progress?: string | null; // 'beginning', 'middle', 'end', or a page number string like '42'
  totalPages?: number | null; // optional, if the parent knows total page count
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ageHint = body.childAge ? `${body.childName || "the child"} is ${body.childAge}` : (body.childName || "the child");

    const progressDescription = (() => {
      if (!body.progress || body.progress === "beginning") return "just started the book (beginning)";
      if (body.progress === "middle") return "about halfway through the book";
      if (body.progress === "end") return "near the end of or just finished the book";
      const page = parseInt(body.progress, 10);
      if (!isNaN(page)) {
        return body.totalPages
          ? `on page ${page} of ${body.totalPages}`
          : `on page ${page}`;
      }
      return "somewhere in the book";
    })();

    const sys = `You help a parent have a great conversation about a book their child is reading.
You are given a photo of the book (the cover, a page, or the child holding the book).

The child is currently: ${progressDescription}.

IMPORTANT: Do NOT ask questions that reveal, hint at, or spoil plot points, character fates, or events beyond where the child currently is. All questions must be spoiler-free relative to their progress.

Identify the book title if visible. Then craft 3 short, warm conversation questions for the parent to ask ${ageHint ? `${ageHint}` : "the child"}:

Question 1: Always about what is VISIBLE in the photo — the cover art, illustration, title, or anything specific you can see in the image.

Question 2 and Question 3: Tailor to progress level:
- BEGINNING (just started): Ask about first impressions and predictions. E.g. "What do you think the book will be about?", "Why did you choose this book?", "What do you think will happen based on the cover?"
- MIDDLE (partway through): Ask about the story so far — characters, favourite moments, predictions for what's ahead. E.g. "Who's your favourite character so far and why?", "What's been the most exciting part?", "What do you think will happen next?" Never ask about the ending or events that may happen later.
- END (near end or finished): Ask about the whole book — the ending, themes, overall reaction. E.g. "What was your favourite part of the whole book?", "Was the ending what you expected?", "Would you recommend it to a friend and why?"
- SPECIFIC PAGE (e.g. page 42): Similar to middle, but only ask about things that plausibly happened before that page. Do not hint at anything that may happen later.

Keep all questions kid-friendly and age-appropriate.`;

    const match = body.image.match(/^data:(.+?);base64,(.*)$/);
    const mediaType = match?.[1] || "image/jpeg";
    const imageData = match?.[2] || body.image;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: sys,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageData } },
              { type: "text", text: "Identify the book and produce the 3 questions." },
            ],
          },
        ],
        tools: [{
          name: "reading_questions",
          description: "Return book title and 3 conversation questions",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Detected book title, or empty string if unknown" },
              question_1: { type: "string" },
              question_2: { type: "string" },
              question_3: { type: "string" },
            },
            required: ["title", "question_1", "question_2", "question_3"],
            additionalProperties: false,
          },
        }],
        tool_choice: { type: "tool", name: "reading_questions" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Anthropic API error", aiRes.status, t);
      const status = aiRes.status === 429 ? 429 : 502;
      const msg = aiRes.status === 429
        ? "Rate limit exceeded, please try again shortly."
        : "AI request failed";
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiRes.json();
    const toolUseBlock = json.content?.find((block: any) => block.type === "tool_use");
    let parsed: any = {};
    if (toolUseBlock?.input) {
      parsed = toolUseBlock.input;
    }

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