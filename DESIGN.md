# monad-metropolis — Style Reference
> bright, rounded, sui.io-inspired: white canvas, deep navy ink, Sui-blue accent with sun, mint and coral pops

**Theme:** light, with deep navy bands for contrast sections.

The interface follows the sui.io look: a white canvas, oversized semibold headlines in deep navy, pill-shaped controls, large rounded cards in saturated pastel tints, and one bright blue accent. Numbers still run in a tabular monospaced font so digits line up, because this is still a credit product.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| White | `#FFFFFF` | `--bg` | Page canvas |
| Deep Navy | `#011829` | `--fg`, `--navy` | Primary text, dark bands, active nav pill |
| Navy Soft | `#0B2A44` | `--navy-soft` | Cards on navy bands, text on tinted tiles |
| Slate Blue | `#3D5870` | `--fg-muted` | Secondary text (7:1 on white) |
| Mist | `#F3F8FF` | `--surface` | Quiet card and table fills |
| Mist Raised | `#E4F0FF` | `--surface-raised` | Hover, selected, table header |
| Haze Line | `#D3E4F8` | `--border` | Hairline borders |
| Sui Blue | `#4DA2FF` | `--accent` | Primary action fill, focus ring, logo dot |
| Link Blue | `#0A62C9` | `--accent-ink` | Accent used as text or link (5.5:1 on white) |
| Navy Ink | `#011829` | `--accent-contrast` | Text on any bright fill |
| Sky | `#C0E6FF` | `--sky` | Tinted tile, hero wash, ring |
| Mint | `#5BE3B0` | `--mint` | Positive highlight tile |
| Sun | `#FFD84D` | `--sun` | Warm highlight tile, warning border |
| Coral | `#FF8A78` | `--coral` | Warm highlight tile, tertiary accent |
| Success Ink | `#0A7A55` | `--ok` | Allowed or matching result text |
| Danger | `#C8283F` | `--danger` | Refused or mismatch text |

Bright fills (blue, sky, mint, sun, coral) always carry navy text, never white. White text is only used on navy.

## Tokens — Typography

- **Sans:** Geist (`--font-sans`), weights 400, 500, 600. Headlines semibold, `tracking-tight`, `leading-[1.05]`.
- **Mono:** Geist Mono (`--font-mono`) for every number, address, hash and table figure.
- **Hero H1:** `text-5xl` to `text-6xl`. Section H2: `text-4xl`. Card titles: `text-xl`. Body `text-base` or `text-lg`; captions `text-sm`.
- No italics, no weight above 600. Headings use `text-wrap: balance`, body uses `text-wrap: pretty` (set globally).

## Tokens — Shapes

| Element | Value |
|---------|-------|
| cards, tiles, tables | `--radius: 1.5rem` |
| inputs, radio rows, notices | `--radius-sm: 0.75rem` |
| buttons, nav, badges | `--radius-pill: 9999px` |

Shadow: `--shadow: 0 18px 40px -22px rgba(1,24,41,0.28)`, used on floating nav, hero tiles and the tier table.

## Components

- **Primary CTA:** pill, Sui Blue fill, navy text, trailing circular navy badge with `↗` that nudges up and right on hover. Hover turns the fill navy with white text.
- **Secondary button:** pill, white fill, navy border or hairline, fills navy on hover.
- **Nav:** floating white pill with blur, sticky, active link is a navy pill with white text.
- **Stat tile:** large rounded tile in a pastel tint (sky, mint, sun, coral, mist) with navy text and a mono value at `text-3xl`.
- **Card:** `--radius`, hairline border, `--surface` fill.
- **Table:** rounded wrapper with hairline border, `--surface-raised` header row, mono numeric columns.
- **Input:** `--radius-sm`, white fill, hairline border, blue border and sky ring on focus.
- **Badge:** pill, `--surface-raised` fill, `--accent-ink` text, for functional status only.
- **Navy band:** full width `--navy` section with `--navy-soft` cards; accent labels in mint, sun, coral and blue.

## Page frame

Every route renders through `components/page-shell.tsx` (`PageShell`): skip link, floating nav, a washed header band with a `text-5xl` to `text-6xl` title and intro, content at `max-w-6xl` with `gap-16`, and the shared footer. The landing page uses the same nav, skip link and footer with its own hero. `app/not-found.tsx` uses the shell too. New pages must use it rather than rebuilding the header.

## Do's and Don'ts

### Do
- Keep the page white and let color live in a few large tiles and the navy bands.
- Use one bright tint per tile and keep text navy for contrast.
- Keep pill shapes for anything clickable, big radii for containers.
- Render every figure in Geist Mono.
- Keep focus rings visible (`3px --accent` outline) and honor `prefers-reduced-motion`.

### Don't
- Don't put white text on Sui Blue, mint, sun or coral.
- Don't use `--accent` as body text on white; use `--accent-ink`.
- Don't stack decorative chips above the H1 or add `border-l` accent stripes.
- Don't use purple gradients. The only gradient is the soft sky and mint hero wash.
- Don't add motion beyond the hero tile drift, hover lifts and button nudges.

## Imagery

Bold flat tiles and real data from `PROOF_RUNS.json` carry the hero. No stock photography and no fake dashboard mockups.

## Quick Color Reference
- text: #011829
- muted text: #3D5870
- background: #FFFFFF
- border: #D3E4F8
- accent: #4DA2FF (text variant #0A62C9)
- pops: mint #5BE3B0, sun #FFD84D, coral #FF8A78, sky #C0E6FF

## Quick Start

```css
@import "tailwindcss";

:root {
  --bg: #ffffff;
  --fg: #011829;
  --fg-muted: #3d5870;
  --surface: #f3f8ff;
  --surface-raised: #e4f0ff;
  --border: #d3e4f8;
  --accent: #4da2ff;
  --accent-ink: #0a62c9;
  --accent-contrast: #011829;
  --radius: 1.5rem;
  --radius-sm: 0.75rem;
  --radius-pill: 9999px;
  --shadow: 0 18px 40px -22px rgba(1, 24, 41, 0.28);
}
```

The source of truth is `app/globals.css`; `.kit/theme.json` and `tailwind.config.ts` mirror it.
