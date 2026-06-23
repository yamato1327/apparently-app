## Root cause

**Email problem (confirmed):** `send-insight-emails` loads events with:
```ts
.from("events").in("date", [todayStr, tomorrowStr])
```
This only returns events whose **seed `date` column** equals today or tomorrow. Recurring events store one seed row (e.g. "Giants Training (Tuesdays)" seeded on 2026‑04‑28) and are expanded client‑side via `expandRecurringEvents`. The email function never expands them, so every recurring occurrence — Tuesday's BJJ Training, Sport & Science, Giants Training, School Lunch Orders, etc. — silently disappears from the email. That also starves `parent-tips` of context, which is why the insights feel thin/generic.

The 21 recurring events for the affected user explain the missed content this morning.

**Phone app problem:** The app's `DailyView`/`WeeklyView`/`MonthlyView` already call `expandRecurringEvents`, so the schedule SHOULD render correctly. No service worker is registered (no PWA cache to bust). Most likely cause is one of: (a) auth session expired on the device, (b) `useEvents` fetch returned an error toast that was missed, or (c) the user was viewing a filtered child. We need a quick diagnostic before changing app code.

## Fix plan

### 1. Make insight emails recurrence‑aware (primary fix)

In `supabase/functions/send-insight-emails/index.ts`:

- Replace `loadEventsForUser` so it:
  1. Fetches **all** events for the user (`select id,title,description,date,time,category,child_name,is_completed, is_recurring, recurrence_cycle, recurrence_days, excluded_dates`).
  2. Runs an inline expansion that mirrors `src/lib/recurrence.ts` (daily / weekly / monthly, honoring `recurrence_days` fallback to seed weekday, and `excluded_dates`), bounded to `[today, tomorrow]` in the user's timezone.
  3. Returns the same `{ today, tomorrow }` shape so downstream code (`buildMorningTemplateData`, `buildNightTemplateData`, `callParentTips`) needs no further changes.
- Keep dedupe/sort behavior (`sortAndDedupeEvents`) — it already merges expanded duplicates by `title|date`.
- Preserve seed `id` on expanded occurrences (suffix `::YYYY-MM-DD`) so any link‑backs stay traceable.

No DB schema, no template, no client changes required for this fix.

### 2. Verify after deploy

- Redeploy `send-insight-emails`.
- Trigger a forced morning send for the affected user via the existing test path (`{ test: true, kind: "morning" }`) and confirm Tuesday recurring events now appear.
- Check edge function logs for errors.

### 3. Phone app — diagnose, don't speculate

Before patching the app, gather one signal:
- Ask the user (a) which device/browser, (b) whether they saw a "Failed to load events" toast, (c) whether the child filter chip was set to a specific child. 
- If still broken, add a one‑line `console.error` with the Supabase error code in `useEvents.fetchEvents` and a visible empty‑state hint ("Tap refresh / re‑sign in") so the next failure is self‑describing.

## Technical notes

- The expansion logic must run in Deno (no `date-fns` import needed — use `Date` math; events are date‑only strings so we can iterate in UTC days safely for the small window).
- Window is at most 2 days, so per‑user cost is trivial even with 100+ recurring seeds.
- Keep the `forceTodayStr` test override working.

## Out of scope

- Refactoring `parent-tips` prompts (separate quality concern).
- Restructuring the email template UX (already iterated previously).
