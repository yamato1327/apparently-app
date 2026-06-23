import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, Check, RotateCcw, Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChildren } from "@/hooks/useChildren";
import { useReminders } from "@/hooks/useReminders";
import { useEvents } from "@/hooks/useEvents";
import { toast } from "sonner";
import EventDraftRow from "./EventDraftRow";
import { normalizeDraft, normalizeReminder, type DraftEvent, type DraftReminder } from "@/lib/normalizeDraft";
import type { FamEvent } from "@/types/events";
import { findSimilarEvents } from "@/lib/eventSimilarity";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface EventChatbotProps {
  onConfirm: (events: Omit<FamEvent, "id">[]) => void;
  onClose: () => void;
}

const STARTER: ChatMessage = {
  role: "assistant",
  content:
    "Hey! 👋 Tell me what's going on. Paste an email, share a link, or describe a schedule.\n\nI'll capture both **events** (with times) and **reminders** (notices like \"wear sports uniform Friday\" or \"library books due Monday\").",
};

const EventChatbot = ({ onConfirm, onClose }: EventChatbotProps) => {
  const { children } = useChildren();
  const { addManyReminders } = useReminders();
  const { events: existingEvents, updateEvent: persistEventUpdate } = useEvents();
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER]);
  const [drafts, setDrafts] = useState<DraftEvent[]>([]);
  const [reminders, setReminders] = useState<DraftReminder[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const childOptions = [
    { label: "None", value: "" },
    ...children.map((c) => ({ label: `${c.emoji || "👦"} ${c.name}`, value: c.name })),
    { label: "👨‍👩‍👧‍👦 Family", value: "Family" },
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  const send = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsThinking(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-extract-events", {
        body: { messages: nextMessages, currentDrafts: drafts, currentReminders: reminders },
      });
      if (error) throw error;

      const reply: ChatMessage = {
        role: "assistant",
        content: data.assistantMessage || "(no reply)",
      };
      setMessages((prev) => [...prev, reply]);
      if (Array.isArray(data.drafts)) {
        setDrafts(
          data.drafts.map((d: DraftEvent) => ({
            ...d,
            recurrenceMode: d.recurrenceMode || d.recurrenceCycle,
          }))
        );
      }
      if (Array.isArray(data.reminders)) {
        setReminders(data.reminders);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to chat";
      console.error("chat error:", err);
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${msg}` },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const updateDraft = (idx: number, updates: Partial<DraftEvent>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...updates } : d)));
  };

  const removeDraft = (idx: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const linkDraft = async (idx: number, existingId: string) => {
    const draft = drafts[idx];
    if (!draft) return;
    const target = existingEvents.find((e) => e.id === existingId);
    if (!target) {
      removeDraft(idx);
      return;
    }
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
    removeDraft(idx);
  };

  const updateReminder = (idx: number, updates: Partial<DraftReminder>) => {
    setReminders((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  const removeReminder = (idx: number) => {
    setReminders((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    if (drafts.length === 0 && reminders.length === 0) {
      toast.info("Nothing to add yet — keep chatting!");
      return;
    }
    if (drafts.length > 0) {
      const fam = drafts.map(normalizeDraft);
      onConfirm(fam);
    }
    if (reminders.length > 0) {
      await addManyReminders(reminders.map(normalizeReminder));
    }
    const total = drafts.length + reminders.length;
    toast.success(
      `✅ Added ${drafts.length > 0 ? `${drafts.length} event${drafts.length > 1 ? "s" : ""}` : ""}${
        drafts.length > 0 && reminders.length > 0 ? " and " : ""
      }${reminders.length > 0 ? `${reminders.length} reminder${reminders.length > 1 ? "s" : ""}` : ""}!`
    );
    onClose();
  };

  const resetChat = () => {
    setMessages([STARTER]);
    setDrafts([]);
    setReminders([]);
  };

  return (
    <div className="flex flex-col">
      {/* Chat thread */}
      <div
        ref={scrollRef}
        className="rounded-lg border bg-muted/30 p-3 space-y-2.5 max-h-72 overflow-y-auto mb-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border text-foreground rounded-bl-sm"
              }`}
            >
              {m.role === "assistant" && (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-primary mb-0.5">
                  <Sparkles className="h-2.5 w-2.5" /> Assistant
                </div>
              )}
              {m.content}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex gap-2 mb-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          disabled={isThinking}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60"
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
        />
        <button
          onClick={send}
          disabled={isThinking || !input.trim()}
          className="self-end rounded-lg bg-primary px-3 py-2 text-primary-foreground shadow-soft hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          title="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Drafts (events) */}
      {drafts.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              📝 Draft events ({drafts.length})
            </h3>
            <button
              onClick={resetChat}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reset chat
            </button>
          </div>
          <div className="space-y-3">
            {drafts.map((d, i) => (
              <EventDraftRow
                key={i}
                event={d}
                onChange={(u) => updateDraft(i, u)}
                onRemove={() => removeDraft(i)}
                childOptions={childOptions}
                similarMatches={findSimilarEvents(d, existingEvents)}
                onLink={(existingId) => linkDraft(i, existingId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Reminders captured ({reminders.length})
            </h3>
          </div>
          <div className="space-y-2">
            {reminders.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border bg-card p-3 flex items-center gap-3"
              >
                <span className="text-lg flex-none">{r.emoji || "📌"}</span>
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={r.title}
                    onChange={(e) => updateReminder(i, { title: e.target.value })}
                    className="min-w-0 rounded-md border bg-background px-2 py-1 text-sm text-foreground"
                  />
                  <input
                    type="date"
                    value={r.noticeDate}
                    onChange={(e) => updateReminder(i, { noticeDate: e.target.value })}
                    className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
                  />
                  <select
                    value={r.childName || ""}
                    onChange={(e) =>
                      updateReminder(i, { childName: e.target.value || null })
                    }
                    className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
                  >
                    <option value="">— Anyone</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.emoji || "👦"} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {r.priority === "high" && (
                  <span className="inline-flex items-center rounded-full bg-secondary/15 text-secondary text-[9px] font-bold px-1.5 py-0.5">
                    !
                  </span>
                )}
                <button
                  onClick={() => removeReminder(i)}
                  title="Remove"
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border bg-background py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
        <button
          onClick={handleConfirm}
          disabled={drafts.length === 0 && reminders.length === 0}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground shadow-soft hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Add{" "}
          {drafts.length + reminders.length > 0
            ? `${drafts.length + reminders.length} `
            : ""}
          item{drafts.length + reminders.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
};

export default EventChatbot;
