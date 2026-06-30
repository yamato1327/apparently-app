import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SKIP_LABELS = new Set([
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
  "SPAM",
  "TRASH",
]);

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  labelIds?: string[];
  payload?: {
    headers?: GmailHeader[];
  } & GmailPart;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBodyText(payload?: GmailPart): string {
  if (!payload) return "";
  let text = "";
  let html = "";
  const walk = (part: GmailPart) => {
    if (part.mimeType === "text/plain" && part.body?.data && !text) {
      text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    }
    part.parts?.forEach(walk);
  };
  walk(payload);
  return text.trim() || (html ? stripHtml(html) : "");
}

function getHeader(message: GmailMessage, name: string): string | null {
  const header = message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value ?? null;
}

function isLikelyIrrelevant(message: GmailMessage): boolean {
  if ((message.labelIds || []).some((l) => SKIP_LABELS.has(l))) return true;
  if (getHeader(message, "List-Unsubscribe")) return true;
  return false;
}

async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error("Google token refresh failed:", response.status, errText);
    throw new Error("Failed to refresh Google access token. Try reconnecting Gmail in Settings.");
  }
  return response.json();
}

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: integration, error: integrationError } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (integrationError) {
      console.error("Failed to load user_integrations:", integrationError);
      return new Response(JSON.stringify({ error: "Failed to load Gmail connection" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!integration?.gmail_connected || !integration.google_refresh_token) {
      return new Response(
        JSON.stringify({ error: "Gmail is not connected. Connect Gmail in Settings first.", events: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = integration.google_access_token;
    const expiry = integration.google_token_expiry ? new Date(integration.google_token_expiry).getTime() : 0;
    const needsRefresh = !accessToken || Date.now() >= expiry - 60_000;

    if (needsRefresh) {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({
            error: "Gmail scanning isn't configured yet — GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET need to be set as Supabase Edge Function secrets.",
            events: [],
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refreshed = await refreshGoogleToken(integration.google_refresh_token, clientId, clientSecret);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabase
        .from("user_integrations")
        .update({ google_access_token: accessToken, google_token_expiry: newExpiry })
        .eq("user_id", user.id);
    }

    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=newer_than:14d",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error("Gmail list error:", listRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to read your inbox. Try reconnecting Gmail in Settings.", events: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listData = await listRes.json();
    const messageRefs: { id: string }[] = listData.messages || [];

    const draftEvents: Record<string, unknown>[] = [];
    let relevantCount = 0;

    for (const ref of messageRefs) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) continue;

      const message: GmailMessage = await msgRes.json();
      if (isLikelyIrrelevant(message)) continue;

      const subject = getHeader(message, "Subject") || "(no subject)";
      const bodyText = extractBodyText(message.payload);
      if (bodyText.length < 20) continue;

      relevantCount++;

      const { data: extracted, error: extractError } = await supabase.functions.invoke(
        "extract-events",
        {
          body: {
            textContent: `This content is from an email. Subject: ${subject}\n\n${bodyText.slice(0, 8000)}`,
          },
        }
      );

      if (extractError) {
        console.error("extract-events invoke error for message", ref.id, extractError);
        continue;
      }

      for (const event of extracted?.events || []) {
        draftEvents.push({ ...event, sourceEmailSubject: subject, sourceMessageId: ref.id });
      }
    }

    await supabase
      .from("user_integrations")
      .update({ gmail_last_scanned_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({ events: draftEvents, scanned: messageRefs.length, relevant: relevantCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scan-gmail error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", events: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
