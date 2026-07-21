# Ishidatami — Vault's design system

*Ishidatami* (石畳) is the fitted-stone paving of a Japanese garden path: plain
material, exact seams, quiet order. Vault's UI follows the same idea — restraint,
hairline borders instead of shadows, and one small red accent that carries the
brand. The tokens below live in [`web/app/globals.css`](web/app/globals.css) as a
Tailwind v4 `@theme` block, so every value here is the value the app renders.

## Colors

| Token | Hex | Role |
| --- | --- | --- |
| `ink` | `#16161A` | Primary text |
| `paper` | `#FAF8F5` | Page background |
| `surface` | `#FFFFFF` | Cards, header, inputs |
| `torii` | `#D9381E` | **The** accent — Sell, Buy, brand dot. Kept to ≤5% of any screen |
| `moss` | `#2E7D5B` | Success / escrow released / positive money |
| `kohaku` | `#C98A0B` | Pending / warnings / funded |
| `indigo` | `#31456A` | Links and **security contexts** (sign-in, MFA, sessions), text selection |
| `sumi-60` | `#5E5E66` | Secondary text |
| `sumi-40` | `#94949E` | Tertiary text, captions |
| `sumi-20` | `#DEDCD6` | Hairline borders |
| `sumi-10` | `#EFECE7` | Image placeholders, inline code |

The three status hues are used at 10% opacity for chips and banners
(`bg-indigo/10`, `bg-moss/10`, `bg-kohaku/10`) and full strength for text.

**The co-creation cue:** on `/sell`, an AI-suggested field carries a 4px `indigo`
left border until the human edits it — a visible "AI proposed, you decided"
signal ([`web/app/sell/SellForm.tsx`](web/app/sell/SellForm.tsx)).

**Status → color map** (fixed, in [`web/components/StatusBadge.tsx`](web/components/StatusBadge.tsx)):
active/completed → `moss`; funded/reserved/pending → `kohaku`; shipped → `indigo`;
sold → `sumi-60`; cancelled/refunded/withdrawn → `sumi-40`/`kohaku`.

## Type

- **Inter** for Latin, **Noto Sans JP** for Japanese, both via `next/font`
  (self-hosted, no layout shift) — wired in
  [`web/app/layout.tsx`](web/app/layout.tsx).
- Scale (px): 12 · 14 · 16 · 20 · 24 · 32. Weights: 400 / 500 / 700.
- **All money uses the `money` utility** — `tabular-nums` + a hair of negative
  tracking — so digits align in columns (wallet, checkout, price tags).

## Shape & space

- 4px spacing grid throughout.
- Radii: **8px** for cards/surfaces (`rounded-[8px]`), **6px** for controls
  (`rounded-[6px]`), full for category chips.
- **Borders over shadows.** Surfaces are separated by `sumi-20` hairlines, not
  drop shadows. There is exactly **one** elevation token, `--shadow-elevated`,
  reserved for modals and toasts.
- Hover is expressed with motion and border, not shadow: cards lift `-2px` and
  their image scales `1.04`; buttons shift opacity.

## Components

Button · Input · Select · Modal · Toast · Tabs · Badge (fixed state-color map) ·
Card · **ListingCard** · **PriceTag** (the `money` utility) · **OrderTimeline**
(the escrow funnel) · **StatusBadge** · **SuggestionField** (the AI-prefilled
input with the indigo cue) · EmptyState (dashed `sumi-20` border) ·
**CategoryChips**.

The **IdP screens are deliberately distinct** from the storefront — an indigo
`VAULT ID` wordmark and an `indigo`-forward palette
([`web/app/auth/IdCard.tsx`](web/app/auth/IdCard.tsx)) — because the identity
provider is its own product.

## Motion

- 150ms on hover/press (colors, opacity, the card lift).
- 250–300ms on the card image zoom and modal/toast transitions.
- Suggestion fields fill in as the assistant responds. Nothing else animates.

## Why no dark mode

A single, well-tuned light theme keeps the palette honest — the torii red and
the three status hues are calibrated against `paper`, and one theme means one
set of contrast decisions to get right. Dark mode is deliberately out of scope.

## Screenshots

Capture from a seeded stack (`make up && make seed`, then `localhost:3000`):
home hero + grid, a listing detail, `/sell` mid-suggestion (indigo cues), the
escrow `OrderTimeline`, `/wallet`, and the admin trust queue. Drop them in
`docs/screenshots/` and reference them here.
