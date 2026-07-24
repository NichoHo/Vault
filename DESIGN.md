# Slate: Vault's design system

*Slate* replaces the original **Ishidatami** system (see git history). Where
Ishidatami was warm paper, hairline seams and one small red accent, Slate is a
cool neutral surface scale with soft elevation, frosted chrome, and a single
indigo trust hue. Depth comes from surface level and light shadow rather than
borders alone. The tokens below live in
[`web/app/globals.css`](web/app/globals.css) as Tailwind v4 `@theme` blocks, so
every value here is the value the app renders.

## Colors

Both themes ship. Dark is not a tint of light; the solids **lighten** so link
and status text clears 4.5:1 on a dark canvas.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `canvas` | `#F6F7F9` | `#0B0E14` | Page background |
| `surface` | `#FFFFFF` | `#131823` | Cards, header, inputs |
| `surface-2` | `#FBFCFD` | `#19202D` | Raised / alternate rows |
| `ink` | `#0F1524` | `#E8ECF3` | Primary text |
| `ink-2` | `#38414F` | `#C0C8D6` | Secondary text |
| `muted` | `#5B6474` | `#96A0B2` | Tertiary text, captions |
| `faint` | `#9096A2` | `#7D8698` | Placeholder, disabled |
| `line` | `#E6E8EE` | `#242B3A` | Hairline borders |
| `line-strong` | `#D3D7DF` | `#333C4F` | Hover borders, dividers |
| `fill` | `#EEF0F4` | `#1A2130` | Chips, inline code, image placeholders |
| `accent` | `#4F46E5` | `#8B93F8` | **The** hue: links, primary CTA, focus ring, security contexts |
| `accent-strong` | `#4338CA` | `#A9B0FC` | Hover / pressed |
| `accent-tint` | `#EEF0FE` | `#1B2040` | Accent-tinted surfaces |
| `on-solid` | `#FFFFFF` | `#0B0E14` | Foreground on any solid fill |
| `success` | `#157A53` | `#35C88D` | Escrow released / positive money |
| `warning` | `#B45309` | `#E0A33A` | Pending / funded / warnings |
| `danger` | `#C81E14` | `#F27B72` | Errors, destructive, negative money |

Each semantic hue also has a `-tint` surface for chips and banners
(`bg-success-tint`, `bg-warning-tint`, `bg-danger-tint`) in place of the old
10%-opacity overlays.

### The `on-solid` rule

**Never put `text-white` on a solid fill.** A solid's foreground is always
`text-on-solid`. Dark mode lightens the solids, so white on a light indigo button
would fail contrast; `on-solid` flips to near-black there, keeping buttons and
badges legible in both themes.

### Legacy aliases

The Ishidatami names (`torii`, `moss`, `kohaku`, `indigo`, `sumi-60/40/20/10`,
`paper`) are still defined, mapped onto Slate through `var()`: `torii`/`indigo` →
`accent`, `moss` → `success`, `kohaku` → `warning`, `sumi-60/40/20/10` →
`muted`/`faint`/`line`/`fill`, `paper` → `canvas`. Pages not yet migrated inherit
both the restyle **and** dark mode with no edits. New code uses the semantic
names.

**`torii` is no longer red.** Anything that meant *danger* now uses `danger`:
error text, negative ledger amounts, insufficient funds, the admin Reject
action, the high-risk score badge. `torii` survives only as a primary-CTA fill.

**The co-creation cue:** on `/sell`, an AI-suggested field carries a 4px `accent`
left border until the human edits it, a visible "AI proposed, you decided"
signal ([`web/app/sell/SellForm.tsx`](web/app/sell/SellForm.tsx)).

**Status → color map** (fixed, in [`web/components/StatusBadge.tsx`](web/components/StatusBadge.tsx)):
active/completed → `success`; funded/reserved/pending → `warning`; shipped →
`accent`; sold → `muted`; cancelled/refunded → `faint`.

## Type

- **Inter** for Latin, **Noto Sans JP** for Japanese, both via `next/font`
  (self-hosted, no layout shift), wired in
  [`web/app/layout.tsx`](web/app/layout.tsx).
- Scale (px): 12 · 14 · 16 · 20 · 24 · 32 · 48. Weights: 400 / 500 / 600 / 700.
- Headings carry `tracking-tight` and `text-pretty`; the hero runs to 48px.
- **All money uses the `money` utility** (`tabular-nums` plus a hair of negative
  tracking) so digits align in columns (wallet, checkout, price tags).

## Shape & space

- 4px spacing grid throughout.
- Radii: **14px** cards (`rounded-card`), **10px** controls (`rounded-control`),
  20px hero, full for chips and small pills.
- Container `max-w-6xl`; padding `px-4 → sm:px-6 → lg:px-8`; section rhythm
  `gap-12 → sm:gap-16`.
- **Elevation is declared once.** A surface takes a shadow *or* a border, never
  both, because a hairline under a wide soft shadow is a ghost card. Listing cards are
  shadow-only; hero, chips, empty states and banners are border-only.

## Elevation & glass

- Three soft layered shadows: `shadow-sm` at rest, `shadow-lg` on card hover,
  `shadow-md` on the focused skip link. In dark they go **darker than the
  canvas**, because a light shadow on a dark surface reads as fog, not depth.
- `glass` is a translucent surface plus `blur(14px) saturate(1.5)`, used on the
  sticky header only so scrolled content reads through it. A specific effect,
  not decoration.
- `wash-accent` is a two-stop radial tint of `accent` and `success` over
  `surface`, used for the hero.

## Components

Button · Input · Select · Modal · Toast · Tabs · **StatusBadge** (fixed state
map) · Card · **ListingCard** (shadow-only surface, `-4px` hover lift + 1.05
image zoom) · **PriceTag** (the `money` utility) · **OrderTimeline** (the escrow
funnel) · **SuggestionField** (the AI-prefilled input with the accent cue) ·
**CategoryChips** · **EmptyState** · **ServiceUnavailable**.

**EmptyState vs ServiceUnavailable.** "No rows" and "the backend is down" must
never look the same, or an outage reads as data loss.
[`ServiceUnavailable`](web/components/ServiceUnavailable.tsx) renders when a
fetch *throws*; the wallet copy states explicitly that it is **not** a zero
balance, because a misread there is a trust failure.

The **IdP screens are deliberately distinct** from the storefront, with an
`accent` `VAULT ID` wordmark and an accent-forward palette
([`web/app/auth/IdCard.tsx`](web/app/auth/IdCard.tsx)), because the identity
provider is its own product.

## Motion

- 150–200ms on hover/press (colors, the card lift).
- 500ms ease-out on the card image zoom; 250ms modal/toast.
- Suggestion fields fill in as the assistant responds. Nothing else animates.
- Everything collapses under `prefers-reduced-motion: reduce`.

## Dark mode

Shipped, defaulting to `prefers-color-scheme` (the visitor's own system
setting, not a category default) with a header toggle that overrides it and
persists to `localStorage`. An inline script in `layout.tsx` writes
`<html data-theme>` before first paint, so there's no flash of the wrong theme;
`ThemeToggle` rewrites the same attribute on click, holding no React state.

Only the **base** tokens are overridden, in a single `:root[data-theme="dark"]`
block at the end of `globals.css`; the legacy aliases resolve through `var()`
and follow automatically, so no component carries a `dark:` variant. The
`dark:` variant is redeclared against `data-theme` (`@custom-variant`) for the
handful of places that need it, currently just the toggle's sun/moon swap.
`color-scheme` tracks the chosen theme so native controls and scrollbars
follow. No `themeColor` viewport pair: it would keep painting mobile browser
chrome from the OS preference after the user overrides it.

## Screenshots

Capture from a seeded stack (`make up && make seed`, then `localhost:3000`) in
**both themes**: home hero + grid, a listing detail, `/sell` mid-suggestion
(accent cues), the escrow `OrderTimeline`, `/wallet`, and the admin trust queue.
Drop them in `docs/screenshots/` and reference them here.
