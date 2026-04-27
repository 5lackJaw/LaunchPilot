# LaunchBeacon Design System — Developer Handoff
**Version**: 2.0 (April 2026) — supersedes any prior PDF or design doc  
**Status**: Canonical. If values here conflict with any other source, use this file.

---

## About This Package

These are design references created as HTML prototypes. Your task is to **recreate these designs in the existing Next.js / Tailwind / shadcn codebase** — do not ship the HTML files directly. Use these as pixel-level reference for colors, type, spacing, and interaction patterns.

**Fidelity**: High-fidelity. Colors, typography, spacing, and interactions are final and should be matched precisely.

---

## ⚠️ Stale Token Warning

An earlier PDF is circulating with incorrect values. **Discard those.** Correct values are in this file.

| Token | ❌ Old (stale PDF) | ✅ Correct |
|---|---|---|
| Background | `#0F0F0F` | `#0B0B0C` |
| Card surface | `#1A1A1A` | `#17171A` |
| Border | `#2A2A2A` | `#232328` |
| Purple / primary | `#534A87` | `#7C6FF7` |
| Teal / success | `#1D9E75` | `#2DD4A0` |
| Amber / pending | `#0BA751` | `#F0A429` |
| Red / error | `#C2383B` | `#F06060` |
| Serif font | (none) | Gloock |

---

## Product Name

**LaunchBeacon** — camelCase, one word, capital L and B. No spaces, no hyphen. This replaces the previous working name "LaunchPilot" everywhere.

---

## globals.css — Drop-in replacement

Replace the `:root` block in `src/app/globals.css` with the following:

```css
@import url('https://fonts.googleapis.com/css2?family=Gloock&family=Inter:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:ital,wght@0,400;0,500;1,400&display=swap');

:root {
  /* Backgrounds */
  --background:           240 5% 5%;        /* #0B0B0C */
  --card:                 240 7% 9%;        /* #17171A */
  --secondary:            240 7% 9%;        /* #17171A */
  --muted:                240 7% 9%;        /* #17171A */

  /* Borders & inputs */
  --border:               240 7% 17%;       /* #232328 */
  --input:                240 7% 17%;       /* #232328 */

  /* Foregrounds */
  --foreground:           240 10% 92%;      /* #E8E8EC */
  --card-foreground:      240 10% 92%;
  --secondary-foreground: 240 10% 92%;
  --muted-foreground:     240 5% 45%;       /* #6B6B78 */

  /* Primary — purple */
  --primary:              248 89% 70%;      /* #7C6FF7 */
  --primary-foreground:   0 0% 100%;
  --ring:                 248 89% 70%;

  /* Accent — teal */
  --accent:               163 65% 50%;      /* #2DD4A0 */
  --accent-foreground:    160 80% 8%;

  /* Destructive — red */
  --destructive:          0 82% 66%;        /* #F06060 */
  --destructive-foreground: 0 0% 100%;

  /* Radius */
  --radius: 0.5rem;

  /* Fonts */
  --font-serif:    'Gloock', Georgia, serif;
  --font-sans:     'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono:     'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
}

html {
  background: hsl(var(--background));
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
}

body {
  min-height: 100vh;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
}
```

---

## Color Tokens (Hex reference)

### Backgrounds
| Token | Hex | Usage |
|---|---|---|
| `--lp-bg` | `#0B0B0C` | Page / html base |
| `--lp-bg2` | `#111113` | Sidebar |
| `--lp-bg3` | `#17171A` | Card backgrounds |
| `--lp-bg4` | `#1D1D21` | Hover surface, elevated |

### Borders
| Token | Hex | Usage |
|---|---|---|
| `--lp-border` | `#232328` | Default border on all elements |
| `--lp-border2` | `#2E2E35` | Hover border, strong dividers |
| `--lp-subtle` | `#3A3A44` | Disabled, placeholders |

### Foregrounds
| Token | Hex | Usage |
|---|---|---|
| `--lp-text` | `#E8E8EC` | Primary text |
| `--lp-muted2` | `#8A8A95` | Secondary / tertiary text |
| `--lp-muted` | `#6B6B78` | Dimmed / metadata text |

### Accent palette
| Token | Hex | Usage |
|---|---|---|
| `--lp-purple` | `#7C6FF7` | Primary actions, active nav, logo |
| `--lp-purple-l` | `#A99DF9` | Purple text on dark bg |
| `--lp-purple-dim` | `rgba(124,111,247,0.08)` | Active nav bg, badge bg tint |
| `--lp-teal` | `#2DD4A0` | Success, live status, positive metrics |
| `--lp-teal-dim` | `rgba(45,212,160,0.10)` | Teal bg tint |
| `--lp-amber` | `#F0A429` | Warning, pending counts |
| `--lp-amber-dim` | `rgba(240,164,41,0.12)` | Amber bg tint |
| `--lp-red` | `#F06060` | Error, destructive, negative metrics |
| `--lp-red-dim` | `rgba(240,96,96,0.12)` | Red bg tint |

---

## Typography System

### Three fonts — three roles

| Font | Role | Never use for |
|---|---|---|
| **Gloock** | Serif display — insight leads, page titles, section headings | Body text, labels, buttons |
| **Inter** | Body + UI — all prose, nav items, buttons, form fields | Replacing Gloock in display contexts |
| **JetBrains Mono** | Data + labels — timestamps, badges, metadata, table values, section eyebrows | Paragraph text |

### Scale

| Class | Font | Size | Weight | Notes |
|---|---|---|---|---|
| `t-display` | Gloock | 34px | 400 italic | Insight leads, hero copy |
| `t-page-title` | Gloock | 22px | 400 roman | AppTopbar `<h1>` |
| `t-heading` | Gloock | 18px | 400 roman | Card / section heading |
| `t-body` | Inter | 14px | 400 | Default body text |
| `t-ui` | Inter | 13px | 500 | Nav items, card labels, UI text |
| `t-ui-small` | Inter | 12px | 400 | Secondary labels, captions |
| `t-mono` | JetBrains Mono | 11px | 400 | Timestamps, metadata |
| `t-label` | JetBrains Mono | 10px | 400 UPPER | Section eyebrows, nav group headers |
| `t-badge` | JetBrains Mono | 9.5px | 500 | Badge text, counts |

### Wordmark — special case
```
Font:          Inter (Display optical size)
Weight:        500 / Medium
Style:         Roman — never italic
Letter-spacing: -0.05em
Case:          LaunchBeacon — camelCase exactly
Color (dark):  #EEEEF2
Color (light): #0F0F0E
Use:           Logo lockup only. Do not use this spec for any UI text.
```

### Tailwind config additions
```ts
fontFamily: {
  sans:  ['Inter', ...defaultTheme.fontFamily.sans],
  mono:  ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
  serif: ['Gloock', ...defaultTheme.fontFamily.serif],
},
```

---

## Spacing & Sizing

| Token | Value | Usage |
|---|---|---|
| Page padding | `28px` | Outer content padding |
| Card padding | `20px` (p-5) | Card interior |
| Panel padding | `18px` | Sidebar, card headers |
| Tight padding | `14px` | Compact rows, section headers |
| Nav item gap | `9px` | Icon-to-label gap in nav |
| Sidebar width | `220px` | Fixed, not collapsible on desktop |

### Corner radii
| Usage | Value | Tailwind |
|---|---|---|
| Small tags, inner elements | `4px` | `rounded` |
| Buttons, controls | `7px` | `rounded-[7px]` |
| Cards, panels | `10px` | `rounded-[10px]` |
| Logo mark square | `7px` | `rounded-[7px]` |
| Badges, pills | `9999px` | `rounded-full` |

---

## Component Specs

### AppShell (Sidebar)
- Width: `220px`, fixed
- Background: `#111113`
- Border-right: `1px solid #232328`
- Logo block: `padding: 17px 18px 14px`, border-bottom
  - SVG icon: `24×24px`, fill `#7C6FF7`
  - Wordmark: Inter, 16px, 500, `letter-spacing: -0.05em`, color `#EEEEF2`
- Nav section label: JetBrains Mono, 10px, UPPERCASE, `letter-spacing: 0.08em`, color `#6B6B78`, padding `12px 18px 3px`
- Nav item: `padding: 7px 18px`, Inter 13px 400, color `#6B6B78`
  - Hover: background `#17171A`, color `#C8C8CE`
  - Active: background `rgba(124,111,247,0.08)`, color `#E8E8EC`, weight 500
  - Active left rail: `2px solid #7C6FF7`, `border-radius: 0 2px 2px 0`, `top: 4px, bottom: 4px`
  - Nav icon: `15×15px`, `opacity: 0.65` inactive, `opacity: 1` active
- Inbox badge: `#F0A429` bg, `#000` text, JetBrains Mono 9.5px 500, `padding: 1px 5px`, `border-radius: 10px`
- Footer: `padding: 10px 18px`, avatar 26×26px circle, border `1px solid #7C6FF7`, bg `rgba(124,111,247,0.10)`

### AppTopbar
- Background: `#0B0B0C`, `border-bottom: 1px solid #232328`
- Padding: `13px 28px`
- Page eyebrow: JetBrains Mono 10px UPPER, `letter-spacing: 0.08em`, color `#6B6B78`
- Page title (`<h1>`): Gloock, 22px, 400, `letter-spacing: -0.01em`
- Product switcher: `#17171A` bg, `border: 1px solid #232328`, `border-radius: 8px`, `padding: 6px 10px 6px 9px`
  - Active dot: `6px` teal circle, `box-shadow: 0 0 0 3px rgba(45,212,160,0.1)`
  - Label: Inter 12.5px 500

### Buttons
| Variant | Background | Color | Border | Height | Padding | Radius |
|---|---|---|---|---|---|---|
| default | `#7C6FF7` | `#fff` | none | `36px` | `0 16px` | `7px` |
| secondary | `#17171A` | `#E8E8EC` | `1px solid #232328` | `36px` | `0 16px` | `7px` |
| outline | transparent | `#E8E8EC` | `1px solid #232328` | `36px` | `0 16px` | `7px` |
| ghost | transparent | `#8A8A95` | none | `36px` | `0 12px` | `7px` |
| sm | (inherits) | (inherits) | (inherits) | `32px` | `0 12px` | `7px` |
- Font: Inter 13px 500 (12px for sm)
- Hover: `bg-primary/90` for default; `#1D1D21` for secondary/outline; color `#E8E8EC` for ghost

### Cards
- Background: `#17171A`
- Border: `1px solid #232328`
- Border-radius: `10px`
- Card header: `padding: 12px 18px`, `border-bottom: 1px solid #232328`
  - Title: Inter 13px 500, color `#E8E8EC`
  - Action link: JetBrains Mono 11px, color `#A99DF9`

### Badges
```
Base:     border-radius: 9999px, padding: 2px 8px
Font:     JetBrains Mono, 10px, 500
Borders:  1px solid (color-specific, see below)
```
| Variant | Background | Color | Border |
|---|---|---|---|
| article | `rgba(124,111,247,0.08)` | `#A99DF9` | `rgba(124,111,247,0.2)` |
| reply | `rgba(45,212,160,0.06)` | `#2DD4A0` | `rgba(45,212,160,0.2)` |
| listing | `rgba(240,164,41,0.08)` | `#F0A429` | `rgba(240,164,41,0.2)` |
| outreach | `rgba(240,96,96,0.08)` | `#F06060` | `rgba(240,96,96,0.2)` |
| warning | `rgba(240,164,41,0.10)` | amber-300 | amber-500/25 |
| success | `rgba(45,212,160,0.10)` | emerald-300 | emerald-500/25 |
| danger | `rgba(240,96,96,0.10)` | red-300 | red-500/25 |

### Inbox Item Row
```
Layout:    flex, gap 10px, padding: 12px 18px
Border:    border-bottom: 1px solid #232328
Hover bg:  #1D1D21
Cursor:    pointer
```
- Checkbox: `13×13px`, `accent-color: #7C6FF7`
- Type tag: `border-radius: 4px`, `padding: 2px 7px`, JetBrains Mono 9.5px 500
- Title: Inter 13px 500, color `#E8E8EC`, truncate
- Sub: Inter 11.5px 400, color `#6B6B78`
- Confidence bar: `height: 3px`, `width: 60px`, bg `#232328`, fill teal (articles/replies) or amber (listings)
- Time: JetBrains Mono 10px, color `#3A3A44`, `margin-left: auto`
- **Inline actions**: opacity-0 → opacity-100 on `group-hover`, translate-x-2 → 0, duration 150ms
  - Edit: `border: 1px solid #232328`, `border-radius: 5px`, `padding: 4px 10px`
  - Reject (✕): same as Edit
  - Approve: `bg: rgba(29,158,117,0.15)`, `border: rgba(29,158,117,0.4)`, color `#2DD4A0`

### Insight Bar (Dashboard)
```
border-radius: 9px
border: 1px solid #232328
border-left: 3px solid #7C6FF7   ← left accent only
padding: 16px
background: linear-gradient(180deg, #17171A 0%, #131316 100%)
```
- Icon container: `32×32px`, `border-radius: 8px`, bg `rgba(124,111,247,0.08)`, border `rgba(124,111,247,0.15)`, color `#A99DF9`
- Eyebrow: JetBrains Mono 10px UPPER, `letter-spacing: 0.08em`, color `#A99DF9`
- Headline: Gloock 18px italic, color `#E8E8EC`
- Body: Inter 12.5px 400, color `#6B6B78`, line-height 1.6
- **Inline metrics**: wrap `<strong>` in color — `#2DD4A0` positive, `#F06060` negative

### Metric Cards
```
background: #17171A
border: 1px solid #232328
border-radius: 10px
padding: 16px
```
- Label: JetBrains Mono 10px UPPER, `letter-spacing: 0.05em`, color `#6B6B78`
- Period: JetBrains Mono 9px, color `#3A3A44`
- Value: Gloock 28px, color `#E8E8EC`, `line-height: 1`, `letter-spacing: -0.01em`
- Delta: JetBrains Mono 11px — `#2DD4A0` up, `#F06060` down, `#6B6B78` neutral

### Sparklines (SVG)
- Line: `height: 24px`, teal stroke `#2DD4A0`, glow line at 20% opacity behind
- Bar: teal or purple fill, opacity ramp `0.3 → 1.0` left to right, `border-radius: 2px`

### Keyword Table
- Header row: JetBrains Mono 10px UPPER, `letter-spacing: 0.05em`, color `#6B6B78`, `padding: 8px 18px`, border-bottom
- Data rows: `padding: 10px 18px`, border-bottom between rows
  - Keyword: Inter 12.5px, color `#E8E8EC`
  - Position: JetBrains Mono 12px — `#2DD4A0` (#1–10), `#F0A429` (#11–20), `#A99DF9` (new/tracking)
  - Change: JetBrains Mono 10.5px — teal up, red down, purple new
  - Volume: JetBrains Mono 12px, color `#6B6B78`
- Row hover: background `#1D1D21`

### Autopilot Segmented Control
```
Container: border: 1px solid #232328, bg: #17171A, border-radius: 6px, padding: 2px
Segments:  border-radius: 4px, padding: 4px 9px
Font:      JetBrains Mono 10.5px
```
| State | Background | Color |
|---|---|---|
| off (active) | `#1D1D21` | `#E8E8EC` |
| L1 (active) | `rgba(240,164,41,0.10)` | `#F0A429` |
| L2 (active) | `rgba(45,212,160,0.10)` | `#2DD4A0` |
| inactive | transparent | `#6B6B78` |

### Status Dots
- OK / live: `6px` circle, `#2DD4A0`, `box-shadow: 0 0 5px rgba(45,212,160,0.5)`
- Warning: `6px`, `#F0A429`
- Off / disconnected: `6px`, `#6B6B78`, `opacity: 0.4`

### Confidence Bars
- `height: 3px`, `width: 60px`, `border-radius: 9999px`, bg `#232328`
- Fill: `#2DD4A0` for articles/replies; `#F0A429` for listings/outreach

### Text Inputs
```
background: #17171A
border: 1px solid #232328
border-radius: 7px
padding: 8px 12px
color: #E8E8EC
font-family: Inter, 13px
```
- Focus: `border-color: #7C6FF7`, `box-shadow: 0 0 0 2px rgba(124,111,247,0.15)`
- Error: `border-color: #F06060`, `box-shadow: 0 0 0 2px rgba(240,96,96,0.10)`
- Placeholder: color `#3A3A44`

---

## Interaction Rules

- **Transitions**: `transition: color 0.12s, background 0.12s` on nav items and buttons
- **Inline action reveal**: `transition: opacity 150ms, transform 150ms` — opacity 0→1, translateX(8px)→0
- **Focus**: `outline: 2px solid #7C6FF7`, `outline-offset: 2px` — all interactive elements
- **Hover row**: background shifts to `#1D1D21` (bg4)
- **No scale transforms** on hover — only color/background changes
- **No heavy shadows** — `box-shadow` only for glow on teal status dot and focus rings

---

## Copy Rules

- **Positive metric inline** → `<strong style="color:#2DD4A0">+478 visits</strong>`
- **Negative metric inline** → `<strong style="color:#F06060">−2 positions</strong>`
- Page titles: sentence case (`"Approval inbox"`, not `"Approval Inbox"`)
- Nav labels: title case (`"SEO Content"`, `"Marketing Brief"`)
- Section eyebrows: UPPERCASE mono (`"INSIGHT · THIS WEEK"`)
- Button copy: sentence case, verb-first (`"Approve all high-confidence (3)"`)
- Empty states: direct, no drama (`"Nothing pending. You're caught up."`)
- **No emoji** in UI — Unicode symbols only (`◫ ◈ ∿ ⊙ ◉ ⚡`)

---

## Logo Usage

- **SVG file**: `assets/logo.svg` (beacon/wifi + diamond icon, single path)
- **Icon color**: `#7C6FF7` — never recolor
- **Wordmark**: "LaunchBeacon" · Inter Display · 500 · `letter-spacing: -0.05em` · never italic
- **Wordmark color on dark**: `#EEEEF2`
- **Sidebar usage**: SVG `24×24px` + wordmark at 16px, gap 9px
- **Minimum size**: 24px tall on screen — below this, icon only

---

## Reference Files (in design system project)

| File | What it contains |
|---|---|
| `colors_and_type.css` | All CSS custom properties, font imports, semantic classes |
| `preview/colors-base.html` | Background + foreground color swatches |
| `preview/colors-accents.html` | Purple, teal, amber, red — full + dim scales |
| `preview/type-scale.html` | Full type scale with usage notes |
| `preview/type-specimens.html` | Fonts in context — Gloock display, Inter body, JetBrains Mono labels |
| `preview/components-nav.html` | Sidebar with real logo, active states, user footer |
| `preview/components-buttons.html` | All button variants |
| `preview/components-badges.html` | Badges, status dots, confidence bars |
| `preview/components-cards.html` | Metric card, panel card, insight callout |
| `preview/components-inbox-item.html` | Inbox row — article / reply / listing variants |
| `preview/components-inputs.html` | Text inputs, segmented controls, product switcher |
| `preview/components-sparklines.html` | Sparkline charts, breakdown bars, traffic bars |
| `ui_kits/dashboard/index.html` | **Interactive prototype** — dashboard + inbox, click to navigate |
| `assets/logo.svg` | LaunchBeacon icon SVG (single path) |
