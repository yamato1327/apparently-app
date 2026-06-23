---
name: Milestones
description: Big-event flag with daily AI build-up tips and reminder lead-time
type: feature
---
Events can be flagged as **Milestones** (e.g. reading test, school concert, exam).

**Schema:** `events.is_milestone boolean`, `events.milestone_remind_days_before integer`.

**UI:** AddEventDialog and EditEventDialog show an amber "🏆 Milestone" section under Recurrence. Presets: 3d / 1w / 2w / 1mo + custom. Suggested defaults by category: school/sports = 14d, social = 7d, medical = 3d, general = 7d.

**Insights:** InsightsPanel computes `activeMilestones` (daysUntil within remindDaysBefore) and sends them to `parent-tips`. Edge function returns `milestone_focus` array — 3-4 daily action tips per milestone, tailored to how far away (long-prep / mid / final-week / day-before / today). Rendered as an amber strip ABOVE the time-of-day grid.

**Visual:** EventCard shows 🏆 ribbon ("in Nd" / "TODAY") + amber glow ring when `isMilestone`.
