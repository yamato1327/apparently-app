import { useEffect, useState, useCallback } from "react";
import { Mail, Calendar, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import GmailScanResults from "@/components/GmailScanResults";
import GoogleCalendarResults from "@/components/GoogleCalendarResults";

const IntegrationsStrip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [gmailConnected, setGmailConnected] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [gmailLastScanned, setGmailLastScanned] = useState<string | null>(null);
  const [calendarLastSynced, setCalendarLastSynced] = useState<string | null>(null);

  const [gmailOpen, setGmailOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_integrations")
      .select("gmail_connected, calendar_connected, gmail_last_scanned_at, calendar_last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) return;
    setGmailConnected(data.gmail_connected ?? false);
    setCalendarConnected(data.calendar_connected ?? false);
    setGmailLastScanned(data.gmail_last_scanned_at ?? null);
    setCalendarLastSynced(data.calendar_last_synced_at ?? null);
  }, [user]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleGmailClose = () => {
    setGmailOpen(false);
    fetchIntegrations();
  };

  const handleCalendarClose = () => {
    setCalendarOpen(false);
    fetchIntegrations();
  };

  const formatRelative = (iso: string | null) => {
    if (!iso) return "Never";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (!gmailConnected && !calendarConnected) {
    return (
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-xs text-muted-foreground">
          Connect Gmail or Google Calendar to import events automatically.
        </span>
        <button
          onClick={() => navigate("/settings")}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Settings className="h-3 w-3" /> Settings
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {gmailConnected && (
          <button
            onClick={() => setGmailOpen(true)}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-soft"
          >
            <Mail className="h-3.5 w-3.5 text-primary" />
            Scan Gmail
            <span className="text-muted-foreground font-normal">· {formatRelative(gmailLastScanned)}</span>
          </button>
        )}
        {calendarConnected && (
          <button
            onClick={() => setCalendarOpen(true)}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-soft"
          >
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Sync Calendar
            <span className="text-muted-foreground font-normal">· {formatRelative(calendarLastSynced)}</span>
          </button>
        )}
      </div>

      <GmailScanResults open={gmailOpen} onClose={handleGmailClose} />
      <GoogleCalendarResults open={calendarOpen} onClose={handleCalendarClose} />
    </>
  );
};

export default IntegrationsStrip;
