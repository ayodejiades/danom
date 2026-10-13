// Mirrors the "ledger" theme in .kit/theme.json and DESIGN.md. Tailwind v4 itself reads its design tokens from
// app/globals.css's `@theme inline` block — this is a documentation/tooling artifact.
const theme = {
  "name": "ledger",
  "mode": "light",
  "accent": "#5B3FD6",
  "accentContrast": "#FBF8F1",
  "surfaces": {
    "bg": "#F2EDE2",
    "surface": "#EBE5D7",
    "surfaceRaised": "#E2DBC9",
    "border": "#CFC6B0"
  },
  "text": {
    "fg": "#17140F",
    "fgMuted": "#5C5546"
  },
  "pops": {
    "navy": "#17140F",
    "sky": "#DDD5F7",
    "mint": "#8FD3AE",
    "sun": "#D9A92E",
    "coral": "#D9644A"
  },
  "radii": {
    "radius": "6px",
    "radiusSm": "3px",
    "radiusPill": "3px"
  },
  "shadows": {
    "shadow": "3px 3px 0 #17140F"
  },
  "font": {
    "sans": "Geist",
    "display": "Fraunces",
    "tabular": "Geist Mono"
  }
} as const;

export default theme;
