# Slate Enterprise (v3): Vault's Modern Enterprise Marketplace Design System

*Slate Enterprise (v3)* expands Vault’s design language into a modern, enterprise-grade e-commerce and escrow platform. Drawing design principles from **Shopify Polaris**, **Stripe Connect / Treasury**, **Linear**, and **StockX Verified**, Slate Enterprise introduces a 4-tier surface elevation scale, multi-context security/financial semantics, dense data tables, micro-badge architecture, and high-trust glassmorphism.

The design tokens are defined in [`web/app/globals.css`](web/app/globals.css) using Tailwind v4 `@theme` variables, powering both light and dark themes with zero layout shift.

---

## 1. Design Philosophy & Pillars

1. **Uncompromising Financial Trust**: Escrow transactions, ledger states, and MFA identity verifications are highlighted using dedicated semantic hues. Money and quantitative metrics use tabular numbers (`font-variant-numeric: tabular-nums`).
2. **Multi-Tier Surface Elevation**: Depth is conveyed through subtle surface tinting (`canvas` -> `surface-0` -> `surface-1` -> `surface-2` -> `overlay`) and 1px hairline borders (`line` / `line-strong`) combined with ambient glows (`shadow-glow`).
3. **AI Co-Creation Transparency**: AI suggestions on `/sell` use a distinct Violet tint (`--color-copilot: #8B5CF6`) and 4px left border indicator ("AI Proposed, Human Approved") to maintain clear provenance.
4. **Data Density & Readability**: Compact controls (8px/10px radii), high contrast (>= 4.5:1 WCAG AA), and clear micro-status badges ensure high efficiency for heavy marketplace power users.

---

## 2. Color Palette & Token Scale

Both light and dark themes ship out of the box with strict contrast parity.

### Primary Surface Scale

| Token | Light | Dark | Enterprise Role |
| --- | --- | --- | --- |
| `canvas` | `#F8FAFC` | `#090D16` | App background, deep workspace canvas |
| `surface` | `#FFFFFF` | `#111726` | Primary card surfaces, main content panels |
| `surface-2` | `#F1F5F9` | `#182032` | Elevated rows, active sidebars, hover surfaces |
| `surface-3` | `#E2E8F0` | `#202B42` | Raised control fills, popovers, sub-cards |
| `overlay` | `#FFFFFF/90` | `#111726/85` | Frosted glass headers, flyout drawers, modals |

### Typography & Ink Ramp

| Token | Light | Dark | Accessibility & Usage |
| --- | --- | --- | --- |
| `ink` | `#0F172A` | `#F1F5F9` | Primary headings, table row values (15:1 AA) |
| `ink-2` | `#334155` | `#CBD5E1` | Body copy, secondary titles |
| `muted` | `#64748B` | `#94A3B8` | Metadata, captions, table headers |
| `faint` | `#94A3B8` | `#64748B` | Disabled text, input placeholders |

### Borders & Fills

| Token | Light | Dark | Visual Function |
| --- | --- | --- | --- |
| `line` | `#E2E8F0` | `#1E293B` | Hairline card outlines, subtle dividers |
| `line-strong` | `#CBD5E1` | `#334155` | Focus rings, active tab borders, hover lines |
| `fill` | `#F1F5F9` | `#1E293B` | Table header fills, code blocks, chip backings |

### Semantic Financial & Trust Hues

| Token | Light | Dark | Role in Enterprise Marketplace |
| --- | --- | --- | --- |
| `accent` | `#6366F1` | `#818CF8` | Primary CTA, active navigation, links, focus rings |
| `accent-strong` | `#4F46E5` | `#A5B4FC` | Hover/Active button states, key indicators |
| `accent-tint` | `#EEF2FF` | `#1E1B4B` | Accent surface fills, selected table rows |
| `escrow` / `success` | `#10B981` | `#34D399` | Funds held/released, verified sellers, positive balance |
| `escrow-tint` | `#ECFDF5` | `#064E3B` | Escrow active banners, positive money pills |
| `warning` | `#F59E0B` | `#FBBF24` | Pending inspection, reserve hold, warning badges |
| `warning-tint` | `#FFFBEB` | `#451A03` | Pending state banners, payout holds |
| `danger` | `#EF4444` | `#F87171` | Dispute opened, payment error, high risk score |
| `danger-tint` | `#FEF2F2` | `#450A0A` | Error banners, cancelled orders, revoke actions |
| `copilot` | `#8B5CF6` | `#A78BFA` | AI assistant suggestions, automated pricing bands |
| `copilot-tint` | `#F5F3FF` | `#2E1065` | AI proposal field backgrounds |
| `on-solid` | `#FFFFFF` | `#090D16` | Contrast-safe text on solid filled buttons |

---

## 3. Typography & Grid Layout

- **Font Family**: `Inter Display` for headings, `Inter` for interface elements, `Geist Mono` / `JetBrains Mono` for hashes, audit logs, and API tokens.
- **Type Scale (px)**: `11` (micro captions/badges) · `13` (table cell data) · `14` (body/input) · `16` (subheadings) · `20` (card title) · `24` (page title) · `36` (hero headline).
- **Tabular Money Rule**: All currency displays MUST use `@utility money` (`tabular-nums` + `-0.01em` tracking) so financial numbers align pixel-perfectly in enterprise data columns.
- **Container Grid**: `max-w-7xl` centered container, `12-column` fluid grid, responsive sidebars (280px fixed filter/navigation panel).

---

## 4. Radii, Elevation & Ambient Shadows

- **Border Radius**:
  - `rounded-control` (8px): Inputs, selects, compact table buttons.
  - `rounded-card` (12px): Standard marketplace cards, widget panels.
  - `rounded-panel` (16px): Large modal dialogs, flyout drawers, hero containers.
  - `rounded-full`: Status pills, verification tags, user avatars.
- **Layered Elevation**:
  - `shadow-sm`: Rest state for input fields and subtle raised cards.
  - `shadow-md`: Hover state for listing items (-2px vertical lift).
  - `shadow-glow`: Subtle ambient indigo/emerald halo around active trust components (`0 0 20px -5px rgba(99, 102, 241, 0.25)`).

---

## 5. Enterprise Component Patterns

1. **Verified Listing Card**:
   - 12px rounded surface, hairline border (`border-line`), shadow hover lift.
   - Top-right verified seller badge with escrow shield icon.
   - Price tag in `money` tabular font with inline currency code (`USD`).
2. **Escrow Lifecycle Timeline (`OrderTimeline`)**:
   - 4-step horizontal/vertical progress tracker: `Funded` -> `Item Shipped` -> `Under Inspection` -> `Escrow Released`.
   - Active step features pulsing emerald ring + transaction ledger audit ID link.
3. **AI Copilot Listing Field (`/sell`)**:
   - AI prefilled inputs feature a 4px left violet border (`border-copilot`) and a subtle "AI Proposed" chip until modified by human user.
4. **Identity & MFA Security Panel**:
   - Status indicators with green checkmarks for TOTP MFA, active OAuth 2.0 PKCE session tokens, and tamper-evident audit logs.

---

## 6. Motion & Accessibility

- **Micro-Transitions**: 150ms `cubic-bezier(0.16, 1, 0.3, 1)` for hover, focus, and button press states.
- **Accessibility Guarantee**: Full WCAG AA compliance (4.5:1 contrast for all text), explicit focus ring outline (`2px solid var(--color-accent)`), and full `prefers-reduced-motion` fallbacks.
