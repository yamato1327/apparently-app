import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CalendarEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: CalendarEventDateTime;
  end?: CalendarEventDateTime;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCalendarDate(dt?: CalendarEventDateTime): { date: string; time?: string; isAllDay: boolean } {
  if (!dt) return { date: new Date().toISOString().substring(0, 10), isAllDay: true };

  if (dt.dateTime) {
    // dateTime format: "2026-07-15T10:00:00+10:00" or "2026-07-15T10:00:00Z"
    const date = dt.dateTime.substring(0, 10);
    const time = dt.dateTime.substring(11, 16);
    return { date, time, isAllDay: false };
  }

  if (dt.date) {
    return { date: dt.date, isAllDay: true };
  }

  return { date: new Date().toISOString().substring(0, 10), isAllDay: true };
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
    throw new Error("Failed to refresh Google access token. Try reconnecting Google in Settings.");
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
      return new Response(JSON.stringify({ error: "Failed to load Google Calendar connection" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!integration?.calendar_connected || !integration.google_refresh_token) {
      return new Response(
        JSON.stringify({
          error: "Google Calendar is not connected. Reconnect Google in Settings to grant calendar access.",
          events: [],
        }),
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
            error: "Google Calendar sync isn't configured yet — GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET need to be set as Supabase Edge Function secrets.",
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

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=50&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!calRes.ok) {
      const errText = await calRes.text();
      console.error("Google Calendar API error:", calRes.status, errText);

      if (calRes.status === 403 || calRes.status === 401) {
        return new Response(
          JSON.stringify({
            error: "Google Calendar access was denied. Reconnect Google in Settings to grant calendar access.",
            events: [],
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to read your Google Calendar. Try reconnecting Google in Settings.", events: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const calData = await calRes.json();
    const calendarEvents: CalendarEvent[] = calData.items || [];

    const draftEvents = calendarEvents
      .filter((event) => event.status !== "cancelled" && event.summary)
      .map((event) => {
        const { date, time, isAllDay } = parseCalendarDate(event.start);
        const description = event.description
          ? stripHtml(event.description).slice(0, 500) || undefined
          : undefined;

        return {
          title: event.summary!,
          date,
          time: isAllDay ? undefined : time,
          description,
          location: event.location || undefined,
          category: "general" as const,
          isAllDay,
          googleCalendarId: event.id,
          sourceCalendarTitle: "Google Calendar",
        };
      });

    await supabase
      .from("user_integrations")
      .update({ calendar_last_synced_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({ events: draftEvents, fetched: calendarEvents.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-google-calendar error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", events: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
