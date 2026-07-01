import { useEffect, useState } from "react";
import { Loader2, X, Check, Calendar } from "lucide-react";
import { useGoogleCalendarSync, type CalendarDraftEvent } from "@/hooks/useGoogleCalendarSync";
import { useChildren } from "@/hooks/useChildren";
import { useEvents } from "@/hooks/useEvents";
import { normalizeDraft } from "@/lib/normalizeDraft";
import { findSimilarEvents } from "@/lib/eventSimilarity";
import EventDraftRow from "./EventDraftRow";

interface GoogleCalendarResultsProps {
  open: boolean;
  onClose: () => void;
}

const GoogleCalendarResults = ({ open, onClose }: GoogleCalendarResultsProps) => {
  const { sync, syncing, drafts, setDrafts, error } = useGoogleCalendarSync();
  const { children } = useChildren();
  const { events: existingEvents, addEvent } = useEvents();
  const [addedCount, setAddedCount] = useState(0);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [hasSynced, setHasSynced] = useState(false);

  const childOptions = [
    { label: "None", value: "" },
    ...children.map((c) => ({ label: `${c.emoji || "👦"} ${c.name}`, value: c.name })),
    { label: "👨‍👩‍👧‍👦 Family", value: "Family" },
  ];

  useEffect(() => {
    if (!open) return;
    setAddedCount(0);
    setDismissedCount(0);
    setHasSynced(false);
    setDrafts([]);
    sync().then(() => setHasSynced(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const updateDraft = (idx: number, updates: Partial<CalendarDraftEvent>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...updates } : d)));
  };

  const acceptDraft = async (idx: number) => {
    const draft = drafts[idx];
    if (!draft) return;
    await addEvent(normalizeDraft(draft));
    setAddedCount((c) => c + 1);
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const dismissDraft = (idx: number) => {
    setDismissedCount((c) => c + 1);
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalFound = addedCount + dismissedCount + drafts.length;
  const allDecided = hasSynced && !syncing && drafts.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-xl border bg-card p-6 shadow-elevated mx-4 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Google Calendar Sync
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {syncing && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-foreground">📅 Fetching your upcoming events...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Looking ahead 60 days in your Google Calendar
            </p>
          </div>
        )}

        {!syncing && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!syncing && !error && drafts.length > 0 && (
          <div className="space-y-4 mb-4">
            {drafts.map((d, i) => (
              <div key={d.googleCalendarId ?? i} className="space-y-1.5">
                <EventDraftRow
                  event={d}
                  onChange={(u) => updateDraft(i, u)}
                  onRemove={() => dismissDraft(i)}
                  childOptions={childOptions}
                  similarMatches={findSimilarEvents(d, existingEvents)}
                />
                <p className="text-[10px] text-muted-foreground pl-1">
                  From: {d.sourceCalendarTitle}
                  {d.location ? ` · 📍 ${d.location}` : ""}
                </p>
                <button
                  onClick={() => acceptDraft(i)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Check className="h-3 w-3" /> Add to Apparently
                </button>
              </div>
            ))}
          </div>
        )}

        {!syncing && !error && allDecided && totalFound === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No upcoming events found in the next 60 days.
          </p>
        )}

        {!syncing && !error && allDecided && totalFound > 0 && (
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              Found {totalFound} event{totalFound === 1 ? "" : "s"} — {addedCount} added, {dismissedCount} dismissed
            </p>
          </div>
        )}

        {!syncing && (
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-lg border bg-background py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default GoogleCalendarResults;
