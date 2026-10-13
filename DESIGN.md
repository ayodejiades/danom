# Danom — Style Reference
> night ledger: a near-black canvas, paper-coloured type, one luminous Monad violet, and a single lit object, the paper receipt

**Theme:** dark. The page reads like a ledger kept at night: ruled lines, clauses, stamps and one sheet of real paper under a lamp.

Danom is a credit product, so the interface borrows from the paper that credit used to live on, and sets it in the dark, luminous register of current web3 landing pages. Headlines are a display serif with one italic word in violet. Figures are monospaced. Containers have hairline borders and almost square corners; buttons are letterpress blocks with a hard offset shadow that the press pushes flat. A refusal is a red stamp and an allowed action is a green one. The hero carries three light sources: a glowing horizon arc, a banknote rosette, and the receipt itself.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Night | `#0B0A10` | `--bg` | Page canvas |
| Deep Night | `#07060A` | `--navy` | Closing band and footer |
| Slate | `#14121B` | `--paper` | Cards, table fills, ticker |
| Slate Band | `#100E16` | `--surface` | Alternate section band |
| Paper White | `#F1ECE1` | `--fg` | Text, button outlines |
| Faded | `#A39D90` | `--fg-muted` | Secondary text (7.4:1 on night) |
| Hairline | `#2C2838` | `--border` | Row rules, dashed rules |
| Line | `#3D3750` | `--line` | Card borders, section dividers |
| Monad Violet | `#836EF9` | `--accent` | The one accent: glow, button shadow, chart fill, focus ring |
| Violet Light | `#AB9BFF` | `--accent-ink` | Accent as text (italic headline word, clause numbers) |
| Stamp Red | `#FF7566` | `--danger` | Refused |
| Stamp Green | `#5FD39A` | `--ok` | Allowed, funded, matches |

Inside `.receipt` the tokens flip back to ink on paper (`--paper: #FBF8F1`, `--fg: #17140F`, red `#B3261E`, green `#1F6B45`), so the receipt is the brightest thing on the page. Red and green only report the verdict of a check. Violet is the only decorative color.

## Tokens — Typography

- **Display:** Fraunces (`--font-display`), weight 480, optical size 144, `letter-spacing: -0.025em`. Applied to every `h1` and `h2` in `app/globals.css`, and to large figures. One word per headline may be wrapped in `<em>`: it becomes italic and violet.
- **Sans:** Geist (`--font-sans`) for body, `h3` and controls, weights 400 to 600.
- **Mono:** Geist Mono (`--font-mono`) for amounts, addresses, hashes and error names.
- **Caption:** the `.caption` class, mono, 0.72rem, uppercase, tracked. It labels fields and sections the way a printed form does.
- Hero H1 `clamp(2.9rem, 7.4vw, 5.6rem)` at `leading-[0.96]`. Section H2 `text-5xl`. Body `text-base` or `text-lg`, paragraphs capped near 52 to 65 characters.

## Tokens — Shapes

| Element | Value |
|---------|-------|
| cards, tables | `--radius: 6px`, `1.5px` `--line` border |
| inputs, buttons, chips | `--radius-sm` and `--radius-pill`: `3px` |
| section dividers | `1.5px` `--line` rule, full width |

There are no soft drop shadows on cards. Depth comes from light: the violet glow behind the receipt, the horizon arc (`.horizon`) and the radial glow (`.glow`).

## Components

- **Button (`.btn`):** slate fill, paper-white outline and `3px 3px 0` shadow. Hover lifts it one pixel and lengthens the shadow; press pushes it flat. `.btn-primary` is paper-white with a violet shadow. `.btn-sm` is the compact size.
- **Text link (`.link-rule`):** underlined with a rule that turns violet on hover. Used as the secondary action next to a primary button.
- **Nav:** a flat blurred bar with a rule under it. The active link carries a violet underline.
- **Teller window (`components/teller.tsx`):** the hero. A receipt with a torn edge (`.receipt`) that runs the vault's own funding check from `lib/credit.ts` and stamps the result.
- **Stamp (`.stamp`):** double-bordered, rotated, mono capitals. `.stamp-refused` or `.stamp-funded`; `.stamp-in` slams it down.
- **Ticker (`.tape`):** the refused attempts from `PROOF_RUNS.json`, scrolling; pauses on hover.
- **Clause list:** numbered `§` entries, each paired with the error the contract reverts with or the figure the recorded run produced.
- **Ledger cells:** stat grids are one bordered block split by ink hairlines, never separate tinted tiles.
- **Rosette:** a banknote guilloche drawn in violet hairlines over a radial glow, behind the hero and the closing band.
- **Horizon:** one very wide circle with a lit rim at the foot of the hero.

## Page frame

Every route except the landing page renders through `components/page-shell.tsx` (`PageShell`): skip link, nav, a ruled header band (`.hero-wash`) with a caption, a display title and an intro, content at `max-w-6xl`, and the shared footer. The landing page uses the same nav, skip link and footer with its own hero.

## Motion

- Stamps slam, ledger rows print in, buttons press.
- Sections rise on scroll with `animation-timeline: view()` where the browser supports it; elsewhere they are simply visible.
- The rosette turns once every four minutes.
- Everything stops under `prefers-reduced-motion`.

## Do's and Don'ts

### Do
- Keep one accent. Violet decorates; red and green only report a verdict.
- Put real figures from `PROOF_RUNS.json` and real error names next to claims.
- Separate things with rules and space before reaching for a card.

### Don't
- Don't add a second glow color, linear gradients, tinted tiles, pill shapes or soft card shadows.
- Don't light anything brighter than the receipt.
- Don't set body text in the display serif, or headlines in the sans.
- Don't use `--accent` for text on night; use `--accent-ink`.

The source of truth is `app/globals.css`; `.kit/theme.json` and `tailwind.config.ts` mirror it.
