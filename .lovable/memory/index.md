# Project Memory

## Core
- **App Identity:** 🏠 Apparently. Daily/weekly schedule organizer for co-parents.
- **Tech Stack:** React, Supabase (Auth, DB RLS, Edge Functions). PWA with Share Target.
- **Design System:** Editorial-premium "aurora". Fraunces (display serif) + Inter (body) + JetBrains Mono (data). Indigo/cyan/mint palette. Glass + animated mesh + noise. Light + dark with toggle. NO Space Grotesk, NO DM Sans, NO "AI purple".
- **Dashboard Layout:** 1. Better Parent Insights -> 2. Calendars (Daily/Weekly/Monthly) -> 3. Child Dev (bottom).
- **Event Sorting:** Sort 'One-off' events first, then 'Recurring'. Sort chronologically by start time within groups.
- **Event Deduplication:** Always merge events sharing title and date (preserve earliest time, combine descriptions).
- **User Setup:** Mandatory profile/child registry. Auto-import Australian school terms by selected state.

## Memories
- [Design System](mem://style/design-system) — Aurora editorial language, Fraunces/Inter, glass, animated mesh, light+dark toggle
- [AI Event Extraction](mem://features/ai-extraction) — Gemini batch processing with interactive review
- [Input Methods](mem://features/input-methods) — Email/content input via PWA Share Target
- [Add Events Chatbot](mem://features/add-events-chatbot) — Conversational AI flow for adding events with multi-turn drafts
- [Onboarding](mem://features/onboarding) — Mandatory profile setup and regional school terms
- [Children Management](mem://features/children-management) — Child registry, avatars, and event allocations
- [Sorting Logic](mem://features/event-management/sorting-logic) — Primary sort rules for one-off and recurring events
- [Event Recurrence](mem://features/event-management/recurrence) — Daily/weekly/monthly cycle management
- [Event Deduplication](mem://features/event-management/deduplication) — Automated merge logic for overlapping events
- [Milestones](mem://features/event-management/milestones) — Big-event flag with reminder lead-time and AI countdown tips
- [Emoji Logic](mem://features/ui/emoji-logic) — AI assignment for events and picker for children
- [Navigation & Views](mem://features/ui/navigation-and-views) — Dashboard hierarchy and timezone synchronization
- [Event Card](mem://features/ui/event-card) — Expandable interaction pattern for detail views
- [Auth & Profile](mem://features/auth-and-profile) — Supabase authentication and mandatory redirect flows
- [UI Patterns](mem://style/ui-patterns) — 'Scan or Paste' pattern for AI-driven bulk data entry
- [Meeting Lifecycle](mem://features/child-development/meeting-lifecycle) — Pre, during, and post-meeting tracking for child development
- [Better Parent Insights](mem://features/insights/better-parent-insights) — Dynamic 3-column AI guidance shifting by hour
- [Weather Display](mem://features/ui/weather-display) — Header weather strip via Open-Meteo with dynamic greetings
- [Email Summary](mem://features/notifications/email-summary) — Daily briefings sent at 14:30 AWST via pg_cron
- [Weekly View](mem://features/ui/weekly-view) — Heatmap grid with event density and mood emojis
- [Daily Progress](mem://features/event-management/completion) — Gradient progress bar for event completion
- [Monthly View](mem://features/ui/monthly-view) — 7-column grid with daily event caps and details
- [Reminders](mem://features/reminders) — Lightweight one-off teacher notices shown in dashboard strip
