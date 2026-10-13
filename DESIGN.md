# Danom — Style Reference
> security paper and ink: a warm paper canvas, near-black ink, one violet ink accent, and rubber stamps for refused and allowed

**Theme:** light. The page reads like a ledger sheet: ruled lines, receipts, clauses and stamps. The only dark surface is the closing band, which runs into the footer.

Danom is a credit product, so the interface borrows from the paper that credit used to live on. Headlines are set in a display serif with one italic word in violet ink. Figures are set in a monospaced face. Containers have hard ink borders and almost square corners; buttons are letterpress blocks with a hard offset shadow that the press pushes flat. A refusal is a red stamp and an allowed action is a green one.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Paper | `#F2EDE2` | `--bg` | Page canvas |
| Fresh Paper | `#FBF8F1` | `--paper` | Receipts, cards, table fills, text on ink |
| Ink | `#17140F` | `--fg`, `--navy` | Text, hard borders, the closing band |
| Soft Ink | `#3A352B` | `--navy-soft` | Secondary text on tinted fills |
| Faded Ink | `#5C5546` | `--fg-muted` | Secondary text (6.6:1 on paper) |
| Manila | `#EBE5D7` | `--surface` | Alternate section band |
| Manila Deep | `#E2DBC9` | `--surface-raised` | Quiet fills, muted text on ink |
| Rule | `#CFC6B0` | `--border` | Hairlines, dashed rules |
| Violet Ink | `#5B3FD6` | `--accent` | The one accent: button shadow, chart fill, focus ring, active nav rule |
| Violet Ink Dark | `#4A31B8` | `--accent-ink` | Accent used as text (italic headline word, clause numbers) |
| Pale Violet | `#DDD5F7` | `--sky` | Accent on ink, input focus ring |
| Stamp Red | `#B3261E` | `--danger` | Refused |
| Stamp Green | `#1F6B45` | `--ok` | Allowed, funded, matches |
| Ochre | `#D9A92E` | `--sun` | Wrong-network button |
| Notice | `#F1E3B3` | `--warn-bg` | Notice fill |

Red and green are reserved for the verdict of a check. Violet is the only decorative color.

## Tokens — Typography

- **Display:** Fraunces (`--font-display`), weight 480, optical size 144, `letter-spacing: -0.025em`. Applied to every `h1` and `h2` in `app/globals.css`, and to large figures. One word per headline may be wrapped in `<em>`: it becomes italic and violet.
- **Sans:** Geist (`--font-sans`) for body, `h3` and controls, weights 400 to 600.
- **Mono:** Geist Mono (`--font-mono`) for amounts, addresses, hashes and error names.
- **Caption:** the `.caption` class, mono, 0.72rem, uppercase, tracked. It labels fields and sections the way a printed form does.
- Hero H1 `clamp(2.9rem, 7.4vw, 5.6rem)` at `leading-[0.96]`. Section H2 `text-5xl`. Body `text-base` or `text-lg`, paragraphs capped near 52 to 65 characters.

## Tokens — Shapes

| Element | Value |
|---------|-------|
| cards, tables | `--radius: 6px`, `1.5px` ink border |
| inputs, buttons, chips | `--radius-sm` and `--radius-pill`: `3px` |
| section dividers | `1.5px` ink rule, full width |

There are no soft drop shadows on cards. Depth comes from the hard offset shadow on buttons and the drop shadow under the receipt.

## Components

- **Button (`.btn`):** paper fill, ink border, `3px 3px 0` ink shadow. Hover lifts it one pixel and lengthens the shadow; press pushes it flat. `.btn-primary` is ink with a violet shadow. `.btn-sm` is the compact size.
- **Text link (`.link-rule`):** underlined with a rule that turns violet on hover. Used as the secondary action next to a primary button.
- **Nav:** a flat bar with an ink rule under it. The active link carries a violet underline.
- **Teller window (`components/teller.tsx`):** the hero. A receipt with a torn edge (`.receipt`) that runs the vault's own funding check from `lib/credit.ts` and stamps the result.
- **Stamp (`.stamp`):** double-bordered, rotated, mono capitals. `.stamp-refused` or `.stamp-funded`; `.stamp-in` slams it down.
- **Ticker (`.tape`):** the refused attempts from `PROOF_RUNS.json`, scrolling; pauses on hover.
- **Clause list:** numbered `§` entries, each paired with the error the contract reverts with or the figure the recorded run produced.
- **Ledger cells:** stat grids are one bordered block split by ink hairlines, never separate tinted tiles.
- **Rosette:** a banknote guilloche drawn in hairlines behind the hero and the closing band.

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
- Don't add gradients, tinted pastel tiles, pill shapes or soft card shadows.
- Don't set body text in the display serif, or headlines in the sans.
- Don't use `--accent` for long text on paper; use `--accent-ink`.

The source of truth is `app/globals.css`; `.kit/theme.json` and `tailwind.config.ts` mirror it.
