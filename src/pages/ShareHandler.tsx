import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FamEvent, CATEGORY_CONFIG } from "@/types/events";
import { Loader2, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface ExtractedEvent {
  title: string;
  description?: string;
  date: string;
  time?: string;
  category: "school" | "sports" | "medical" | "social" | "general";
  childName?: string;
}

const ShareHandler = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sharedTitle = searchParams.get("title") || "";
  const sharedText = searchParams.get("text") || "";
  const sharedUrl = searchParams.get("url") || "";

  const combinedText = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join("\n\n");

  useEffect(() => {
    if (!combinedText.trim()) {
      setError("No content was shared. Try sharing again from your email app.");
      return;
    }

    const extract = async () => {
      setIsProcessing(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("extract-events", {
          body: { textContent: combinedText },
        });

        if (fnError) throw fnError;

        if (data.events && data.events.length > 0) {
          setExtractedEvents(data.events);
        } else {
          setError("Couldn't find any events in the shared content. Try sharing a different email.");
        }
      } catch (err: any) {
        console.error("Extract error:", err);
        setError(err.message || "Failed to extract events");
      } finally {
        setIsProcessing(false);
      }
    };

    extract();
  }, []);

  const confirmEvents = () => {
    // Store in sessionStorage so the main page can pick them up
    const famEvents = extractedEvents.map((e) => ({
      id: crypto.randomUUID(),
      title: e.title,
      description: e.description,
      date: e.date,
      time: e.time || undefined,
      category: e.category,
      childName: e.childName || undefined,
      isCompleted: false,
    }));
    
    const existing = sessionStorage.getItem("famflow_pending_events");
    const pending = existing ? JSON.parse(existing) : [];
    sessionStorage.setItem("famflow_pending_events", JSON.stringify([...pending, ...famEvents]));
    
    toast.success(`Added ${famEvents.length} event${famEvents.length > 1 ? "s" : ""}!`);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold font-display text-foreground">Apparently</h1>
          <p className="text-sm text-muted-foreground mt-1">Processing shared content...</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          {isProcessing && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
              <p className="text-sm font-medium text-foreground">Reading your email...</p>
              <p className="text-xs text-muted-foreground mt-1">AI is extracting event details</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-destructive font-medium mb-4">{error}</p>
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            </div>
          )}

          {extractedEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Found {extractedEvents.length} event{extractedEvents.length > 1 ? "s" : ""}:
              </h3>
              <div className="space-y-2 mb-4">
                {extractedEvents.map((event, i) => {
                  const cat = CATEGORY_CONFIG[event.category];
                  return (
                    <div key={i} className="flex items-start gap-2 rounded-lg border bg-background p-3">
                      <div className={`mt-0.5 h-8 w-1 flex-shrink-0 rounded-full ${cat.colorClass}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold font-display text-foreground">{event.title}</p>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">📅 {event.date}</span>
                          {event.time && <span className="text-xs text-muted-foreground">🕐 {event.time}</span>}
                          {event.childName && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {event.childName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 rounded-lg border bg-background py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEvents}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground shadow-soft hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Check className="h-4 w-4" />
                  Add All
                </button>
              </div>
            </div>
          )}

          {/* Show what was shared */}
          {combinedText && (
            <details className="mt-4">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                View shared content
              </summary>
              <pre className="mt-2 text-xs text-muted-foreground bg-muted rounded-lg p-3 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {combinedText}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareHandler;
