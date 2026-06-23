---
name: Design System
description: Editorial-premium aurora design — Fraunces serif + Inter, brand palette teal/coral/amber/mint, glassmorphism, light + dark
type: design
---

## Direction
Editorial & premium with WARM aurora palette anchored in deep teal.

## ABSOLUTELY FORBIDDEN
- **No purple/violet anywhere.** No hue in the 250–300 range — not in gradients, not in blob overlays, not in category colors, not in shadows. This includes "indigo-purple" 240–260 and "magenta" 290–320.
- No "AI-app" gradients (purple→cyan, indigo→pink).
- No Space Grotesk / DM Sans (replaced by Fraunces + Inter).

## Typography
- **Display:** Fraunces (variable serif). h1–h6, hero titles, italic accents.
- **Body:** Inter.
- **Mono:** JetBrains Mono. Temperatures, time labels, data.

## Palette (HSL tokens in src/index.css)
- **Primary indigo-blue** `232 70% 56%` light / `218 95% 65%` dark — UI primary only (buttons, links, focus rings). NOT used in hero gradient.
- **Secondary mint** `165 70% 45%`
- **Accent soft cyan** `188 85% 55%`
- **Brand warm trio (used in gradients/blobs):** coral `12 85% 62%`, amber `38 95% 58%`, deep teal `180 70% 38%`
- **Destructive rose** `350 75% 55%`
- Aurora gradient must read coral → amber → mint → teal (NEVER end in purple).

## Signature utilities
- `.gradient-aurora`, `.text-gradient-aurora` (animated, warm trio only)
- `.bg-mesh-animated` for page shells
- `.glass` / `.glass-strong` frosted cards with hairline ring
- `.shadow-glow` primary halo
- `.noise` SVG grain for editorial depth
- `.animate-float` slow vertical drift

## Hero canvas
Dark base under hero gradient is **teal-black** `hsl(180 35% 8%)`, never indigo-black.

## Theme
Light + dark. `src/contexts/ThemeContext.tsx` provider, `src/components/ThemeToggle.tsx` button. Persists to localStorage `apparently.theme`, defaults to system.
