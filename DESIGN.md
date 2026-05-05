# Design Brief

## Direction

SubjectScore — Professional email subject line analyzer optimizing deliverability through live scoring and semantic feedback.

## Tone

Clean, purposeful minimalism focused on information clarity — productivity tool aesthetic with rose-branded accents and semantic color feedback (red/amber/green).

## Differentiation

Inline heatmap highlights (spam/power/warning words) combined with real-time speedometer gauge create immediate visual feedback on email quality.

## Color Palette

| Token        | OKLCH       | Role                           |
| ------------ | ----------- | ------------------------------ |
| background   | 0.98 0.005  | Page background, card negative |
| foreground   | 0.2 0.01    | Primary text                   |
| card         | 1.0 0.0     | Card surface                   |
| primary      | 0.38 0.18 15| Rose brand accent, focus ring  |
| accent       | 0.38 0.18 15| CTA, interactive elements      |
| destructive  | 0.55 0.22 25| Spam words, errors (red)       |
| success      | 0.55 0.18 150| Power words, excellent (green) |
| warning      | 0.7 0.15 85 | Length cautions (amber)        |
| muted        | 0.92 0.01   | Disabled, secondary text       |
| border       | 0.92 0.01   | Card borders, dividers         |

## Typography

- Display: Space Grotesk — headings, hero score, labels
- Body: Plus Jakarta Sans — paragraph text, textarea, feedback
- Scale: Hero `text-7xl md:text-8xl font-black`, h2 `text-3xl font-bold tracking-tight`, label `text-xs font-bold uppercase tracking-widest`, body `text-base leading-relaxed`

## Elevation & Depth

Cards elevated with soft shadows (`shadow-card`). Primary input area uses `shadow-elevated` on focus. Gauge needle casts subtle directional shadow.

## Structural Zones

| Zone    | Background      | Border            | Notes                                    |
| ------- | --------------- | ----------------- | ---------------------------------------- |
| Header  | card (white)    | border (bottom)   | Logo + nav, fixed top                    |
| Banner  | background      | —                 | Ad banner zone 200×960px                 |
| Content | background      | —                 | Two-column: input left, score right      |
| Form    | card (white)    | border (subtle)   | Textarea + char counter in rounded card  |
| Score   | card (white)    | —                 | Gauge + number, centered, `shadow-card` |
| Preview | muted-50 (dark) | —                 | Mobile inbox mockup, syntax highlighted |
| Footer  | card (white)    | border (top)      | Banner zone + nav + copyright            |

## Spacing & Rhythm

Generous 24–32px section gaps, 16px card padding, 8px micro-spacing. Textarea 32px padding, 20px gap between input/preview.

## Component Patterns

- Buttons: rose primary, white text, `rounded-2xl`, hover darkens hue
- Cards: `rounded-2xl`, white background, `shadow-card`, subtle border
- Badges: inline `px-3 py-1 rounded-full text-xs font-semibold`, semantic colors
- Textarea: `rounded-2xl`, `bg-slate-50`, focus ring rose, auto-expand on input

## Motion

- Entrance: score animates from 0 to final value on analyze (0.6s easing)
- Hover: buttons/cards scale subtle (1.02), text links fade to rose accent
- Decorative: pulse on high scores (subtle opacity animation)

## Constraints

- Semantic colors (red/amber/green) must be used for ALL scoring feedback, never neutral
- Rose accent appears ONLY on primary CTAs and brand elements
- No decorative gradients or full-page effects
- Heatmap highlights inline via CSS classes, not DOM manipulation
- Ad banners responsive via CSS, image URLs loaded dynamically

## Signature Detail

Real-time inline syntax highlighting (spam/power/warning words) with semantic color feedback — users see email issues highlight as they type, not in separate feedback cards.
