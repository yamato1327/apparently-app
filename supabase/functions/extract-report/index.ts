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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, childName, childYearLevel } = await req.json();

    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "fileBase64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages: any[] = [];
    const isPdf = typeof fileBase64 === "string" && fileBase64.startsWith("data:application/pdf");

    if (isPdf) {
      // Send PDF natively to Claude as a document — preserves table/grid layout
      // that unpdf loses when converting to plain text.
      const base64Data = fileBase64.split(",")[1] ?? "";
      if (!base64Data) {
        return new Response(
          JSON.stringify({ error: "Could not read PDF data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      messages.push({
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Data,
            },
          },
          {
            type: "text",
            text: `Extract all grades from this school report.${childName ? ` Child's name: ${childName}.` : ""}${childYearLevel ? ` Year level: ${childYearLevel}.` : ""} Read every grade exactly as written — do not guess or invent any values.`,
          },
        ],
      });
    } else {
      const match = fileBase64.match(/^data:(.+?);base64,(.*)$/);
      const mediaType = match?.[1] || "image/jpeg";
      const imageData = match?.[2] || fileBase64;
      messages.push({
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageData } },
          { type: "text", text: `Extract all grades from this school report.${childName ? ` Child's name: ${childName}.` : ""}${childYearLevel ? ` Year level: ${childYearLevel}.` : ""}` },
        ],
      });
    }

    const systemPrompt = `You are an expert at reading Australian school report cards.
Extract the complete structured grades from the report. Only extract what is actually written in the report — do not invent or assume grades.

Australian schools use one of two grading scales:
- Upper primary (Years 3–6): A (Excellent), B (High), C (Satisfactory), D (Limited), E (Very Low)
- Lower primary (Years 1–2): Excellent, High, Satisfactory, Limited, Very Low

For each subject, extract:
- The subject name (e.g. "English", "Mathematics")
- Each sub-area and its grade (e.g. Reading: D, Writing: D)
- The report term/semester and year if visible

For teacher comments: many primary school reports have ONE overall comment for the whole report, not per-subject. If that is the case, put the whole comment in "overall_comment" and leave each subject's "teacher_comment" as an empty string. Only fill "teacher_comment" on a subject if there is a comment clearly written for that specific subject.

For areas graded D, E, Limited, or Very Low — generate 2–3 practical improvement tips for the parent. Tips should be concrete and specific, under 20 words each. Leave improvement_tips as an empty array for grades A, B, C, High, Excellent, or Satisfactory.`;

    const subAreaSchema = {
      type: "object",
      properties: {
        name: { type: "string", description: "Sub-area name, e.g. 'Reading', 'Writing'" },
        grade: { type: "string", description: "Grade: A/B/C/D/E or Excellent/High/Satisfactory/Limited/Very Low" },
        effort: { type: "string", description: "Effort grade if shown, otherwise null" },
        improvement_tips: {
          type: "array",
          items: { type: "string" },
          description: "2-3 improvement tips if grade is D, E, Limited, or Very Low. Empty array otherwise.",
        },
      },
      required: ["name", "grade", "improvement_tips"],
      additionalProperties: false,
    };

    const subjectSchema = {
      type: "object",
      properties: {
        name: { type: "string", description: "Subject name, e.g. 'English', 'Mathematics'" },
        overall_grade: { type: "string", description: "Overall subject grade if shown, otherwise null" },
        teacher_comment: { type: "string", description: "Teacher's comment for this subject, or empty string" },
        sub_areas: {
          type: "array",
          items: subAreaSchema,
          description: "Sub-areas within this subject with individual grades",
        },
      },
      required: ["name", "sub_areas"],
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
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: [
          {
            name: "extract_report",
            description: "Extract structured grades from a school report card",
            input_schema: {
              type: "object",
              properties: {
                child_name: { type: "string", description: "Child's name from the report, or null if not visible" },
                year_level: { type: "string", description: "Year/grade level, e.g. 'Year 4'" },
                report_term: { type: "string", description: "Term or semester, e.g. 'Semester 1', 'Term 2'" },
                report_year: { type: "number", description: "Report year, e.g. 2025" },
                overall_comment: {
                  type: "string",
                  description: "The single overall teacher comment if the report has one comment for the whole report rather than per subject. Empty string if comments are per-subject.",
                },
                subjects: {
                  type: "array",
                  items: subjectSchema,
                  description: "All subjects extracted from the report",
                },
              },
              required: ["overall_comment", "subjects"],
              additionalProperties: false,
            },
          },
        ],
        tool_choice: { type: "tool", name: "extract_report" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolUseBlock = data.content?.find((block: any) => block.type === "tool_use");
    if (!toolUseBlock?.input) {
      return new Response(JSON.stringify({ error: "AI did not return structured data", subjects: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(toolUseBlock.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
