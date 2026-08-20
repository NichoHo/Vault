---
target: web storefront (home, search, listing detail, checkout) vs Amazon/Shopee
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-19T17-11-42Z
slug: web-storefront-home-search-listing-detail-checkout
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No pending/loading feedback on Buy/Pay submits; checkout has no step indicator |
| 2 | Match System / Real World | 1 | Seller shown as a raw truncated UUID instead of a name |
| 3 | User Control and Freedom | 2 | Cancel-order exists, but no persistent cart to add/remove before committing |
| 4 | Consistency and Standards | 3 | shadcn tokens applied consistently; nav matches convention |
| 5 | Error Prevention | 3 | Pay button proactively disables on insufficient funds |
| 6 | Recognition Rather Than Recall | 2 | `BackLink` always returns to `/`, dropping filter/category context |
| 7 | Flexibility and Efficiency | 1 | No sort, price filter, saved search, or any power-user path |
| 8 | Aesthetic and Minimalist Design | 4 | Clean spacing, restrained motion, no visual noise |
| 9 | Error Recovery | 3 | Plain-language errors with recovery actions ("Add demo funds", etc.) |
| 10 | Help and Documentation | 1 | No FAQ/help/contact link anywhere in the shopper flow |
| **Total** | | **22/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Reads as a well-designed internal tool wearing a marketplace skin, not a distinct consumer marketplace. The visual polish (hairline borders, consistent radii, tabular-nums pricing) is genuinely good, but the IA gives it away: the listing page shows the seller as a raw truncated UUID, the home hero markets protocol names (OIDC + TOTP MFA) as if they were consumer trust badges, search has no filters or sort, and the footer is a single centered disclaimer sentence with no link architecture. Strip the color tokens and this is the IA of an admin console: one entity, one price, one raw identifier, one action button.

**Deterministic scan**: CLI detector (`detect.mjs`) found 2 real findings, both outside the reviewed surface (`web/app/sell/` `side-tab` antipattern, `border-l-4`), and 1 false positive on `ListingCard.tsx:11` (`broken-image` — the component actually has a real fallback src and populated alt text). The scoped target files (home/search/listing/checkout/layout) came back clean on the static scan. The browser console overlay, run live against all four pages, told a different story: the brand accent orange (`#fe5922`) fails WCAG AA contrast (2.9–3.3:1 against a 4.5:1 requirement) everywhere it's used as text or a button label — the header "Sell" link, the hero CTA, the "Buy with escrow protection" button, the active category-filter state, and multiple badge pills all fail. Footer text and the "Seller" label also fail at 2.5:1. This is a single root-cause color-token problem hitting a dozen+ instances across every page, not a scattering of unrelated issues.

## Overall Impression

The engineering underneath (OIDC from scratch, double-entry ledger, transactional outbox) is the actual differentiator, and the visual design system (Slate Enterprise v3) has real craft in it — but the storefront's information architecture and its accent color both currently read as "internal tool," not "consumer marketplace." The single biggest opportunity: the IA gaps are concentrated on exactly the two screens a LinkedIn viewer will look at first (home, listing detail), and most of the fixes are small, targeted changes, not a redesign.

## What's Working

- **Money formatting discipline**: the `.money` utility (tabular-nums, tracking) makes prices align pixel-perfectly everywhere they appear. Most portfolio projects skip this.
- **`ServiceUnavailable` vs empty state**: the app deliberately distinguishes "service unreachable" from "catalogue is empty" — a production-grade UX distinction most demos don't bother making.
- **Restrained, purposeful motion**: the sticky header hides/reappears on scroll but explicitly skips that under `prefers-reduced-motion` — motion with a job, not decoration.
- **Real error prevention and recovery**: the Pay button proactively disables on insufficient funds rather than failing after submit, and error copy gives a concrete recovery action instead of a dead end.

## Priority Issues

**[P0] Seller identity is a raw UUID.** `web/app/listing/[id]/page.tsx:62` shows `listing.seller_id.slice(0, 8) + "…"` for non-owners. Amazon shows "Sold by X," Shopee/eBay show a seller card with name, avatar, and rating. This sits on the single highest-trust decision point in the flow. **Fix**: swap in a display name + avatar + a simple trust chip (member since / item count), linking to a minimal seller card. Suggested command: `$impeccable clarify` / `$impeccable shape` (needs a seller-profile surface).

**[P0] No image gallery on the listing page.** Same file, lines 42-48: a single `<img>`, no thumbnails, no zoom, no secondary angles. Every comparable platform treats multi-image as baseline for secondhand goods, since buyers need to inspect condition. Undercuts the "escrow protects you" pitch on the same page. **Fix**: `listing.images: string[]` with a thumbnail strip and image swap. Suggested command: `$impeccable shape`.

**[P1] Brand accent color fails contrast almost everywhere it's used as text.** `#fe5922` on white/tint backgrounds measures 2.9–3.3:1 (needs 4.5:1) on the header "Sell" link, hero CTA, "Buy with escrow protection" button, active filter state, and several badge pills (`web/app/layout.tsx:40-42`, `web/app/page.tsx:29-87`, `web/app/listing/[id]/page.tsx:73-82`, `web/app/search/page.tsx:28-30`). One root-cause token fix (a darker text/button shade of the same hue) resolves a dozen+ instances at once. **Fix**: darken the accent value used for text/button-label contexts in `DESIGN.md`'s token scale; keep the lighter tint for large decorative fills only. Suggested command: `$impeccable audit` then `$impeccable colorize`.

**[P1] Search has no filters or sort.** `web/app/search/page.tsx` — the only control is a static category list. No price range, no condition, no sort-by. This is the primary tool real marketplaces lead with on a browse page. **Fix**: add a sort `<select>` (price, newest) and a price min/max pair, even computed client-side over the fetched results. Suggested command: `$impeccable shape`.

**[P1] Home hero markets protocol internals instead of consumer trust.** `web/app/page.tsx:41-51` puts "OIDC + TOTP MFA," "Escrow ledger," "AI-assisted selling" in the badge row a first-time shopper sees before they've browsed anything. Real marketplaces put "Buyer Protection," "Verified Sellers," "Money-back guarantee" in that exact slot. **Fix**: move the protocol-name badges to an "About/How it's built" section or footer; put shopper-facing trust language in the hero. Suggested command: `$impeccable clarify`.

**[P2] Checkout has no shipping step or itemized cost breakdown, and mobile touch targets run under the 44px minimum.** Checkout jumps straight from item card to a two-line balance/hold summary to Pay, with the same price figure repeated three times and no arithmetic shown between them — reads like a payment test harness. Separately, at a 375px viewport the header "Sell" button (47×32), "Sign in" link (44×20), and search input (height 32) all fall under the 44px touch-target minimum. **Fix**: add a static/mocked address card + 3-line cost breakdown to checkout; bump control heights/padding at mobile breakpoints. Suggested command: `$impeccable adapt` then `$impeccable shape`.

**[P3] Footer is one centered disclaimer sentence with no link architecture.** No About/Help/Returns/Terms/Privacy links — the cheapest, highest-leverage "this is a real company" signal on any commerce site is entirely absent. **Fix**: a standard 3-4 column footer (Company, Help, Legal, Social). Suggested command: `$impeccable layout`.

## Persona Red Flags

**Jordan (first-timer)**: Doesn't know what "OIDC + TOTP MFA" means but shrugs past it on the hero. Opens a listing, sees "Seller: ce2edb66…" and has no answer to the first question any buyer asks — "who am I buying from?" Clicks "Buy with escrow protection" and gets a full-page redirect out of the storefront into a raw OAuth URL (`/idp/authorize?response_type=code&...`) with zero visual continuity to the marketplace chrome — a much harder wall than any real marketplace puts between "I want this" and "I bought it."

**Casey (distracted mobile)**: The category rail correctly collapses to a horizontal scroll strip on mobile, but there's still no sort/filter, so she has to eyeball every card. The listing image is only sticky at `md:` and up, so on mobile she scrolls back up to re-see the product while reading the description. Several tap targets (Sign in: 44×20, Sell button: 47×32) fall under the 44px minimum. She hits the same full-domain IdP redirect as Jordan, which on mobile (visible URL bar switch) reads more like a phishing pattern than a login screen.

**Riley (stress tester)**: Credit where due — race-condition handling is solid ("Someone else got there first" on a double-booked item), insufficient funds is prevented proactively not just caught reactively, and a stale checkout URL for an already-paid order correctly redirects to the order page. Where it breaks: there is no report/block/dispute path anywhere in the shopper flow — if an anonymous seller is a bad actor, the UI has no answer. Riley also immediately asks why the same yen figure is repeated three times on the checkout card with no computation shown between them.

## Minor Observations

- `CategoryChips` (home, pill style) and the search-page category list (flat links) are two separate presentations of the same taxonomy — mildly inconsistent rather than wrong.
- `StatusBadge.tsx:20` uses `.replace("_", " ")` not `.replaceAll` — harmless today (no current status has two underscores) but latent.
- No cart or saved-items icon in the header at all, next to Sell/Sign-in — a visible gap for something meant to read as a real marketplace.
- Single variable font (Plus Jakarta Sans) flagged by the detector as `single-font`/`overused-font` — reads as intentional restraint for a small marketplace demo, not a defect.

## Questions to Consider

- The escrow ledger and OIDC work are the actual engineering flex here. Why hide that behind a plain "Buy" button and one caption line instead of designing the storefront IA around surfacing it (an escrow timeline preview on the listing page, a verified-seller badge system)?
- Is the goal "a believable Amazon-adjacent product" or "a demo that showcases backend rigor to engineers"? The visual system argues for the former; the IA (no filters, no reviews, no seller profiles, one-line footer) argues for the latter. Right now it answers both halfway.
