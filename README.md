# Apparently

Apparently is a family scheduling assistant app. It was originally built by Scott for his own family using Lovable, an AI-powered web app builder. This repository is an extension of that original build, being developed into a product other families can use, with Scott's family as the primary test case throughout.

## What it does

The app helps parents stay on top of family life by bringing together calendar events, school updates, and reading in one place. Key features include AI-powered event extraction from screenshots, PDFs, and Gmail; Google Calendar sync with a review step before events are added; morning and night email digests tailored per user; a reading tracker with AI-generated discussion questions that adapt to where the child is in the book; child development score tracking with school report upload and AI grade extraction; and parent-teacher meeting notes with action item extraction.

## Tech stack

- React 18 + TypeScript, bundled with Vite
- Supabase for Postgres, Auth, Edge Functions, and Storage
- Anthropic API: Claude Haiku for most AI features (event extraction, reading questions, parent tips), Claude Sonnet for PDF school report extraction where higher accuracy matters
- PWA-enabled via vite-plugin-pwa so the app installs like a native app on mobile
- shadcn/ui with Tailwind CSS for the component library
- TanStack Query for server state

## Running locally

```bash
git clone <repo>
cd <repo>
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID
npm install
npm run dev
```

Edge Function secrets (Anthropic API key, Google OAuth client ID and secret) are set in the Supabase dashboard under Project Settings > Edge Functions > Secrets. They are not stored in `.env`.

## Notes

This repo is a development copy pointed at a separate dev Supabase project (`oldioruajgcebdbepzwf`). The live version Scott's family uses is hosted separately on Lovable, backed by a different Supabase project. Schema migrations should be ported to the live project deliberately rather than synced automatically.
