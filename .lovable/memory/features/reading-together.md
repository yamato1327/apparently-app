---
name: Reading Together
description: Per-child book photo upload that AI-detects the title and generates 3 conversation questions; latest book surfaces in Insights
type: feature
---
- Card on the dashboard between calendars and Child Development
- Photo (cover/page/child reading) uploaded to private `reading-photos` bucket, per-user folder
- Edge function `extract-book` (Gemini 2.5 Flash, tool-calling) returns title + 3 questions: Q1 about cover/title, Q2 comprehension, Q3 reflection
- Stored in `reading_books` table (RLS by user_id)
- Insights panel always shows the latest book's questions in a "Tonight's Reading" footer card
