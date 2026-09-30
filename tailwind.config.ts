// Extends the "ledger" preset (templates/_ui/ledger/tailwind.preset.ts
// in the hackathon-starter skill). Tailwind v4 itself reads its design tokens from
// app/globals.css's `@theme inline` block — this is a documentation/tooling artifact.
const theme = {
  "name": "ledger",
  "mode": "dark",
  "accent": "#059669",
  "accentContrast": "#021610",
  "surfaces": {
    "bg": "#0A0D0C",
    "surface": "#121615",
    "surfaceRaised": "#171C1B",
    "border": "#232B29"
  },
  "text": {
    "fg": "#E7F3EF",
    "fgMuted": "#8AA39A"
  },
  "radii": {
    "radius": "0.5rem",
    "radiusSm": "0.25rem"
  },
  "shadows": {
    "shadow": "0 10px 24px -12px rgba(0,0,0,0.7)"
  },
  "font": {
    "sans": "Geist",
    "tabular": "Geist Mono"
  },
  "typeScale": {
    "sm": "0.8125rem",
    "base": "0.9375rem",
    "lg": "1.0625rem",
    "xl": "1.375rem",
    "2xl": "1.75rem"
  }
} as const;

export default theme;
