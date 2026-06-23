import { useState, useCallback } from "react";
import { Camera, Upload, MessageSquare, X, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FamEvent } from "@/types/events";
import { useChildren } from "@/hooks/useChildren";
import { useEvents } from "@/hooks/useEvents";
import { toast } from "sonner";
import EventChatbot from "./EventChatbot";
import EventDraftRow from "./EventDraftRow";
import { normalizeDraft, type DraftEvent } from "@/lib/normalizeDraft";
import { findSimilarEvents } from "@/lib/eventSimilarity";

type ExtractedEvent = DraftEvent;

interface ScreenshotUploadProps {
  open: boolean;
  onClose: () => void;
  onEventsExtracted: (events: Omit<FamEvent, "id">[]) => void;
}

const ScreenshotUpload = ({ open, onClose, onEventsExtracted }: ScreenshotUploadProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([]);
  const [mode, setMode] = useState<"image" | "chat">("image");
  const [dragActive, setDragActive] = useState(false);
  const { children } = useChildren();
  const { events: existingEvents, updateEvent: persistEventUpdate } = useEvents();

  const childOptions = [
    { label: "None", value: "" },
    ...children.map((c) => ({ label: `${c.emoji || '👦'} ${c.name}`, value: c.name })),
    { label: "👨‍👩‍👧‍👦 Family", value: "Family" },
  ];

  const resetState = () => {
    setPreviews([]);
    setExtractedEvents([]);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const updateEvent = (index: number, updates: Partial<ExtractedEvent>) => {
    setExtractedEvents((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...updates } : e))
    );
  };

  const removeEvent = (index: number) => {
    setExtractedEvents((prev) => prev.filter((_, i) => i !== index));
  };

  const linkEvent = async (index: number, existingId: string) => {
    const draft = extractedEvents[index];
    if (!draft) return;
    const target = existingEvents.find((e) => e.id === existingId);
    if (!target) {
      removeEvent(index);
      return;
    }
    // Merge: combine descriptions, keep earliest time
    const descs = [target.description, draft.description].filter(Boolean) as string[];
    const mergedDesc = descs.length > 0 ? [...new Set(descs)].join(" | ") : undefined;
    let mergedTime = target.time;
    if (draft.time) {
      mergedTime = target.time && target.time < draft.time ? target.time : draft.time;
    }
    const updates: Parameters<typeof persistEventUpdate>[1] = {};
    if (mergedDesc !== target.description) updates.description = mergedDesc;
    if (mergedTime !== target.time) updates.time = mergedTime;
    if (Object.keys(updates).length > 0) {
      await persistEventUpdate(target.id, updates);
    }
    toast.success(`🔗 Linked to existing "${target.title.trim()}"`);
    removeEvent(index);
  };

  const processImages = useCallback(async (files: File[]) => {
    setIsProcessing(true);
    setExtractedEvents([]);
    const newPreviews: string[] = [];
    const allEvents: ExtractedEvent[] = [];

    try {
      for (const file of files) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const isPdf = file.type === "application/pdf";
        let previewSrc = base64;
        if (isPdf) {
          const label = file.name.slice(0, 14).replace(/[<>&]/g, "");
          const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 100'>" +
            "<rect width='80' height='100' rx='8' fill='#fee2e2'/>" +
            "<text x='40' y='58' text-anchor='middle' font-family='sans-serif' font-size='18' font-weight='700' fill='#b91c1c'>PDF</text>" +
            "<text x='40' y='80' text-anchor='middle' font-family='sans-serif' font-size='8' fill='#374151'>" + label + "</text>" +
            "</svg>";
          previewSrc = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
        }
        newPreviews.push(previewSrc);
        setPreviews((prev) => [...prev, previewSrc]);

        const { data, error } = await supabase.functions.invoke("extract-events", {
          body: { imageBase64: base64 },
        });
        if (error) throw error;

        if (data.events && data.events.length > 0) {
          const mapped = data.events.map((e: any) => ({ ...e, isRecurring: false }));
          allEvents.push(...mapped);
          setExtractedEvents((prev) => [...prev, ...mapped]);
        }
      }

      if (allEvents.length > 0) {
        toast.success(`🔍 Found ${allEvents.length} event${allEvents.length > 1 ? "s" : ""} across ${files.length} file${files.length > 1 ? "s" : ""}!`);
      } else {
        toast.info("No events found. Try clearer screenshots or PDFs.");
      }
    } catch (err: any) {
      console.error("Extract error:", err);
      toast.error(err.message || "Failed to extract events");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith("image/") || f.type === "application/pdf"
      );
      if (files.length > 0) processImages(files);
    },
    [processImages]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processImages(Array.from(files));
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles: File[] = [];
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) processImages(imageFiles);
    },
    [processImages]
  );

  const confirmEvents = () => {
    const famEvents: Omit<FamEvent, "id">[] = extractedEvents.map(normalizeDraft);
    onEventsExtracted(famEvents);
    toast.success(`✅ Added ${famEvents.length} event${famEvents.length > 1 ? "s" : ""} to your schedule!`);
    handleClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onPaste={handlePaste}>
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg rounded-xl border bg-card p-6 shadow-elevated mx-4 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold font-display text-foreground">📸 Add Events</h2>
          <button onClick={handleClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 mb-5 bg-muted rounded-lg p-1">
          <button
            onClick={() => { setMode("image"); resetState(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
              mode === "image" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
            }`}
          >
            <Camera className="h-3.5 w-3.5" /> 📷 Screenshot
          </button>
          <button
            onClick={() => { setMode("chat"); resetState(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
              mode === "chat" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> 💬 Chat
          </button>
        </div>

        {/* Image mode */}
        {mode === "image" && previews.length === 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Drop screenshots or PDFs here 📎</p>
            <p className="text-xs text-muted-foreground mb-3">or paste from clipboard (Ctrl+V) · PNG, JPG, PDF</p>
            <label className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity">
              <Camera className="h-4 w-4" />
              Choose files
              <input type="file" accept="image/*,application/pdf" multiple onChange={handleFileSelect} className="hidden" />
            </label>
          </div>
        )}

        {/* Image previews */}
        {mode === "image" && previews.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {previews.map((src, i) => (
                <img key={i} src={src} alt={`Upload ${i + 1}`} className="rounded-lg border h-24 object-contain bg-muted flex-shrink-0" />
              ))}
            </div>
            {!isProcessing && extractedEvents.length === 0 && (
              <button
                onClick={() => setPreviews([])}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Upload different images
              </button>
            )}
            {!isProcessing && (
              <label className="mt-2 ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                + Add more
                <input type="file" accept="image/*,application/pdf" multiple onChange={handleFileSelect} className="hidden" />
              </label>
            )}
          </div>
        )}

        {/* Chat mode */}
        {mode === "chat" && (
          <EventChatbot
            onConfirm={(famEvents) => {
              onEventsExtracted(famEvents);
              handleClose();
            }}
            onClose={handleClose}
          />
        )}

        {/* Processing state */}
        {isProcessing && (
          <div className="flex flex-col items-center py-6">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-foreground">🤖 Reading your content...</p>
            <p className="text-xs text-muted-foreground mt-1">AI is extracting event details</p>
          </div>
        )}

        {/* Extracted events - review UI */}
        {extractedEvents.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              🎯 Found {extractedEvents.length} event{extractedEvents.length > 1 ? "s" : ""} — review & customise:
            </h3>
            <div className="space-y-3 mb-4">
              {extractedEvents.map((event, i) => (
                <EventDraftRow
                  key={i}
                  event={event}
                  onChange={(u) => updateEvent(i, u)}
                  onRemove={() => removeEvent(i)}
                  childOptions={childOptions}
                  similarMatches={findSimilarEvents(event, existingEvents)}
                  onLink={(existingId) => linkEvent(i, existingId)}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg border bg-background py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEvents}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground shadow-soft hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <Check className="h-4 w-4" />
                ✅ Add {extractedEvents.length} Event{extractedEvents.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenshotUpload;
