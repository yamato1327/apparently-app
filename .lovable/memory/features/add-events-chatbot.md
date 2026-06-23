---
name: Add Events Chatbot
description: Conversational AI flow inside the Add Events dialog (Chat tab) that builds and refines a list of draft events through multi-turn chat, then commits them.
type: feature
---
The "💬 Chat" tab of the Add Events dialog (`ScreenshotUpload.tsx` → `EventChatbot.tsx`) replaces the old single-shot "Paste Email/Text" textarea. Users converse with the assistant, who can ask clarifying questions, fetch URLs (server-side via the `chat-extract-events` edge function), and progressively build a list of draft events.

- Edge function: `supabase/functions/chat-extract-events/index.ts` — Gemini 2.5 Flash via Lovable AI Gateway, `reply_with_drafts` tool returns `{ assistantMessage, drafts[] }`. Drafts are ALWAYS the full updated list (replace, never append). URLs in user messages are auto-fetched (HTML stripped, max 3 URLs, 6KB each) and appended as context.
- Drafts use the shared `DraftEvent` shape and are normalized to `FamEvent` via `src/lib/normalizeDraft.ts` on confirm.
- Review row UI is shared with the Screenshot tab via `src/components/EventDraftRow.tsx` (recurrence, custom weekdays, milestone toggle + lead-time, child tag).
- Chat history lives only inside the open dialog (cleared on close / reset).