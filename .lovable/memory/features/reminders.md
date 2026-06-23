---
name: Reminders
description: Lightweight one-off teacher notices (uniform, bring x, dress-up, permission slips) shown in dashboard strip; captured via chat or Quick Reminder dialog
type: feature
---
Reminders are lightweight one-off notices distinct from events:
- Stored in `reminders` table (RLS by user_id), no time, optional child_id
- Categories: uniform | bring | dress_up | permission | general
- Priority: normal | high (high gets coral accent)
- Auto-expire after `expires_after` date (default = notice_date)
- Sources: chat | manual | email
- Surfaced in dashboard `RemindersStrip` between Insights and calendars
- Captured by `chat-extract-events` edge fn (returns both `drafts` and `reminders` arrays)
- Manual entry via `QuickReminderDialog`
- Realtime updates via Supabase channel
