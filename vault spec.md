# Vault — Marketplace with Self-Built Identity, Escrow Checkout, and an AI Listing Assistant

*Project specification targeting exactly three listings: Mercari SE Internship (Class of 2028), Mercari Pre-Entry, and HENNGE GIP Full-Stack Pathway.*

---

## 1. The Idea in One Paragraph

**Vault** is a compact C2C marketplace (a micro-Mercari) with three deliberately hard parts built from scratch: **identity** (a real OAuth 2.0 / OIDC provider with TOTP MFA and session security — HENNGE's entire industry), **money** (escrow checkout on a double-entry ledger, extending Tally's proven patterns — Merpay's core loop), and **an AI listing assistant** (photograph an item, get a suggested title, description, category, and price band — the exact class of AI feature Mercari ships in its own app, and direct evidence for their required "results through projects using the latest AI technologies"). Everything is invariant-tested, deployed on AWS with Terraform, and demoable in a browser in under three minutes.

---

## 2. Listing-by-Listing Justification (from the actual JDs)

| Requirement in the listing | Where Vault answers it |
| --- | --- |
| **Mercari:** "Backend: API development experience using languages such as Go, PHP, or Java" | Three Go services (gRPC + REST edge) |
| **Mercari:** "Frontend: development experience using JavaScript, React" | Next.js + TypeScript storefront, their exact stack |
| **Mercari:** "Machine Learning… ML systems" + **required** "results through projects utilizing the latest AI technologies" | AI listing assistant (vision + pricing suggestion), plus Python trust-scoring service |
| **Mercari:** "Platform/SRE: Go, Kubernetes, Terraform" | Terraform-applied AWS deploy; k8s manifests carried over from Tally |
| **Mercari:** "Basic knowledge of RDBMS and SQL", "microservices architecture", "cloud (GCP or AWS)" | PostgreSQL schema-per-service, event-driven services, AWS |
| **Mercari:** BOLD trait "Co-creation with AI" | README documents your AI-assisted dev workflow honestly (which tools, for what, what stayed human) |
| **Mercari domain:** Mercari + Merpay | C2C listings + escrow payments are the product itself |
| **HENNGE:** "Python (non-ML stack), Go, or TypeScript on the back-end; TypeScript with modern front-end frameworks" | Go + Python backends, TypeScript/React front |
| **HENNGE:** "Authentication and security basics" (their training pillar; their product is identity SaaS) | You built the IdP: PKCE, JWKS rotation, refresh-token reuse detection, MFA, audit log |
| **HENNGE:** "Software testing (unit, integration, end-to-end)" | Invariant suite + integration tests + Playwright e2e, documented in "What the tests prove" |
| **HENNGE:** "at least three of: AWS / full-stack dev / distributed systems / DevOps (CI/CD, IaC) / containers" | All five, verifiably in one repo |
| **HENNGE:** "core concepts like security, **state management**, and testing" | Explicit frontend state architecture: TanStack Query for server state, a small Zustand store for session/UI state, trade-offs written up in DESIGN.md |
| **HENNGE:** "Unix-like environments… DevOps tooling" | Makefile-first workflow, shell tooling, structured logs, docker-compose dev loop — documented in the README's "Development" section |
| **HENNGE (essential):** "Interested in open source or tech community activities" | The OSS & Community layer (Section 10): an extracted, published Go package + engineering write-ups + a community talk |

**Timing fit (the real constraint):** Mercari's application closes July 31 and HENNGE screening takes 4+ weeks, so interviews for both land roughly **late August through October 2026**. The project is phased so Phase 1 is demoable in ~3 weeks (before first interviews) and each later phase upgrades the story mid-process. You apply now with Tally as flagship; Vault becomes the "since applying, I've built…" escalation.

---

## 3. Scope Rules

* Three pillars only: identity, escrow, AI assistant. No chat, reviews, ratings, recommendations, points, mobile.
* Buy the boring parts: Postgres full-text search (no Elasticsearch), a storage bucket for images, console-log email.
* HENNGE's AI policy applies to **their coding challenge**, which you write 100% by hand. Vault is your own project where AI-assisted development is fine and disclosed. Keep these separate in your head and in interviews.
* Every money/auth behavior gets a test that proves it. That's the brand Tally started; Vault continues it.
* Honest README: simulated deliveries, synthetic data, no real money, "educational IdP — production should use vetted libraries, here's what building one taught me." That framing pre-empts the only serious criticism.

---

## 4. Architecture

```
            Next.js storefront + IdP screens (TypeScript, App Router)
                                │ HTTPS/JSON
                    ┌───────────▼───────────┐
                    │ gateway (Go, chi)     │  authn middleware, rate limits,
                    └──┬─────────┬───────┬──┘  request IDs, OpenAPI
                 gRPC  │         │       │ gRPC
            ┌──────────▼──┐ ┌────▼────┐ ┌▼─────────────┐
            │ id (Go)     │ │ market  │ │ pay (Go)     │
            │ OIDC, MFA,  │ │ (Go)    │ │ escrow on    │
            │ sessions,   │ │ listings│ │ double-entry │
            │ audit log   │ │ orders  │ │ ledger       │
            └──────┬──────┘ └────┬────┘ └──────┬───────┘
                   └──────┬──────┴──────┬──────┘
                          │  outbox → Redpanda events
            ┌─────────────▼───┐   ┌────▼─────────────────────┐
            │ PostgreSQL      │   │ assist (Python, FastAPI) │
            │ (schema per     │   │ AI listing suggestions + │
            │  service)       │   │ trust scoring            │
            └─────────────────┘   └──────────────────────────┘

```

| Service | Language | Notes |
| --- | --- | --- |
| `id` | Go | Auth Code + PKCE, RS256 JWT + JWKS rotation, rotating refresh tokens with family revocation on reuse, argon2id, TOTP + recovery codes, per-IP/per-account rate limits, sessions with remote revocation, append-only audit log |
| `market` | Go | Listings (state machine: draft→active→reserved→sold|withdrawn), reserve-on-checkout with 15-min TTL, Postgres FTS search, orders |
| `pay` | Go | Tally's rules, single currency: escrow fund/release/refund as atomic double-entry transfers, idempotency keys, lock ordering, int64 minor units |
| `assist` | Python (FastAPI) | (a) Listing assistant: image → suggested title/description/category via a vision-language model API, price band from comparable sold listings (embeddings + nearest neighbors over synthetic history); (b) trust scoring on signups/orders (rules + IsolationForest) feeding an admin review queue. Every suggestion is editable — AI proposes, the human decides, which is precisely Mercari's "co-creation with AI" |
| `web` | Next.js + TS | Storefront + separate IdP screens + small admin. State management is deliberate and documented: TanStack Query owns server state (caching, invalidation, optimistic updates on listing edits), a small Zustand store owns session/UI state, and DESIGN.md explains why neither Redux nor raw context was chosen — exactly the "explain your trade-offs" muscle HENNGE's program trains |

Events use the **transactional outbox** pattern (state change and event written in one DB transaction; relay publishes to Redpanda) — your upgrade over Tally's publish-after-commit, and a ready-made distributed-systems talking point for HENNGE.

---

## 5. Pages (complete)

**Storefront:** 1. `/` home (search, categories, fresh listings) · 2. `/search` (filters, keyset pagination) · 3. `/listing/[id]` (gallery, seller card, Buy) · 4. `/sell` — the showcase page: drop a photo → assistant streams suggested title/description/category/price band into editable fields, with an "AI suggested / you edited" indicator · 5. `/checkout/[orderId]` (idempotent Pay) · 6. `/orders` (purchases/sales tabs) · 7. `/orders/[id]` (escrow timeline: funded → shipped → completed; confirm receipt; cancel/refund) · 8. `/wallet` (balance + own ledger entries — transparency as a feature) · 9. `/profile/[handle]` · 10. `/settings` (profile, EN/JA language toggle)

**IdP screens (visually distinct — the IdP is its own product):** 11. `/auth/login` (+ TOTP step-up) · 12. `/auth/register` · 13. `/auth/consent` (scope grant) · 14. `/auth/mfa` (QR enrollment, recovery codes) · 15. `/auth/sessions` (device list, revoke) · 16. `/auth/forgot`

**Admin:** 17. dashboard (GMV, orders, escrow float, AI suggestion acceptance rate) · 18. trust queue (scores + explanations, approve/reject) · 19. audit log explorer · 20. ledger browser

---

## 6. Design System — "Ishidatami"

Documented in `DESIGN.md` with screenshots.

* **Colors:** `ink #16161A` text · `paper #FAF8F5` background · `surface #FFFFFF` cards · `torii #D9381E` accent (≤5% of any screen) · `moss #2E7D5B` success/escrow released · `kohaku #C98A0B` pending/warnings · `indigo #31456A` links + security contexts (MFA, sessions) · `sumi-60/40/20` greys. AI-suggested content gets a subtle `indigo` left border until the user edits it — a visible co-creation cue.
* **Type:** Inter + Noto Sans JP via `next/font`; scale 12/14/16/20/24/32; weights 400/500/700; `tabular-nums` on all money.
* **Shape/space:** 4px grid, radii 8/6px, borders over shadows, one elevation for modals.
* **Components:** Button, Input, Select, Modal, Toast, Tabs, Badge (fixed state-color map), Card, ListingCard, PriceTag, Timeline, DataTable, Skeleton, EmptyState, SuggestionField (the AI-prefilled input).
* **Motion:** 150ms hover/press, 250ms modal/toast, suggestion fields fade in as they stream. Nothing else. No dark mode.

---

## 7. Data Model (core)

```
id:      users, credentials, totp_secrets, recovery_codes, sessions,
         oauth_clients, auth_codes, refresh_tokens(family_id), consents,
         signing_keys, audit_events, outbox
market:  listings, listing_images, categories, orders(state), reservations(ttl), outbox
pay:     accounts(user | escrow | platform_revenue), transfers(idempotency_key uq),
         entries(int64 minor units), outbox
assist:  suggestions(listing_id, model, prompt_hash, accepted_fields), risk_scores,
         consumed_events, comparables(embedding vector)

```

---

## 8. Phases (vs. the actual selection calendar)

Budget ~10–12 hrs/week. Start early August 2026.

**Phase 0 — Skeleton (1 wk, early Aug):** monorepo, `docker compose up` runs everything, CI (lint/test/race), seed script, Terraform stub. *Done = one command runs the world.*

**Phase 1 — Identity + storefront skeleton (3 wks, Aug):** register/login (argon2id), sessions, Auth Code + PKCE, JWT + JWKS, consent screen, audit log; storefront signs in via your own IdP; listings CRUD without payments. *Done = OIDC round trip demo. This is what you show in first-round interviews and mention in the HENNGE process (~early Sept).*

**Phase 2 — Escrow + orders (3 wks, Sept):** pay service with fund/release/refund, order state machine, reservation TTL, wallet page, invariant suite (escrow zeroes out on completion; concurrent double-spends fail; timer-vs-manual confirm releases exactly once; race detector clean). *Done = the Merpay demo, ready for Mercari technical rounds (~late Sept–Oct).*

**Phase 3 — AI assistant + trust (2–3 wks, Oct):** `/sell` suggestion flow (VLM API + price band from embedded comparables), acceptance-rate metric on admin, trust scoring + review queue, TOTP MFA + refresh rotation with reuse detection. *Done = Mercari's required AI-results box ticked with a product feature, and HENNGE's security-depth story complete.*

**Phase 4 — Ship it + OSS layer (2 wks, late Oct/Nov):** `outboxkit` extraction and publication, the three engineering write-ups, AWS deploy via Terraform (small instance or ECS free tier), seeded live demo + reset cron, Playwright e2e (register → MFA → AI-assisted listing → buy → confirm → wallet reconciles), README with architecture diagram + "What the tests prove" + honest limitations, DESIGN.md, 3-minute demo GIF, OpenAPI spec. *Done = a stranger reaches understanding in 5 minutes.*

**Cut line:** stopping after Phase 2 still yields a complete, CV-worthy project (identity + escrow marketplace). Phase 3 is what lifts the Mercari AI requirement from "portfolio has RAG" to "product ships AI."

---

## 9. Testing (the differentiator, restated)

Invariant suite in CI with `-race`; OIDC misuse tests (wrong `code_verifier`, replayed auth codes, expired codes, JWKS rotation without downtime); property tests on the escrow state machine; one chaos test (kill the outbox relay mid-flow, prove no lost/duplicated events); Playwright e2e happy path. README section: **"What the tests prove."** Both companies name testing explicitly in their listings; almost no student demonstrates it. This is your loudest signal.

---

## 10. Open-Source & Community Layer (added for HENNGE's essential qualification)

"Interested in open source or tech community activities" is an *essential* HENNGE qualification, and it's currently the weakest point in the whole portfolio: every project is a personal repo with no community surface. Vault fixes this structurally, not cosmetically:

**10.1 Extract and publish a real package: `outboxkit`.**
The transactional outbox relay and idempotent-consumer helpers get pulled out of Vault into a standalone Go module, published properly: semver tags, godoc, README with usage examples, CI badge, MIT license, CONTRIBUTING.md, 2–3 good-first-issues. Vault then imports it like any other dependency, which is itself the story: "I extracted the reusable part of my project and maintain it as a library." A focused single-purpose package beats a sprawling one; outbox/idempotency is genuinely underserved in the Go ecosystem and matches your correctness brand.

**10.2 Write it up (3 posts, on your portfolio site or dev.to).**

1. "Building an OIDC provider from the RFCs (and what I got wrong first)" — the HENNGE interview in essay form.
2. "The transactional outbox pattern in practice" — doubles as `outboxkit` documentation.
3. "What my tests prove: invariant testing for money code" — continues the Tally voice.
Each post is ~1,500 words, concrete, with code. These give the HENNGE cover letter and HR interview a "here's my writing" link, and HENNGE explicitly values explanation skills.

**10.3 One community act.**
Present Vault or the outbox pattern at a HIMTI session (you're already in the web development division — this converts an existing membership into visible activity) or a local/online Go or security meetup. One talk, recorded or with slides published, is enough to answer the question honestly in an interview.

**Cost:** ~1 week of effort spread across Phases 2–4 (extraction is mostly moving code you already wrote; posts are written after the code works). **Payoff:** turns an essential-qualification "no" into a differentiated "yes" that almost no student applicant has.

---

## 11. How It Lands in Your Materials

**CV (replaces FaQ Assistant on the Mercari and HENNGE variants once Phase 2 ships):**

> **Vault: marketplace with self-built OIDC identity, escrow payments, and an AI listing assistant** — [github.com/NichoHo/vault](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2FNichoHo%2Fvault)
> • Go microservices (gRPC, PostgreSQL, Redpanda outbox events) behind a Next.js + TypeScript storefront: an OAuth 2.0/OIDC provider (PKCE, RS256 + JWKS rotation, TOTP MFA, refresh-token reuse detection) and escrow checkout on a double-entry ledger; invariant suite proves escrow zeroes out, value is conserved, and concurrent double-spends never succeed
> • Python (FastAPI) assistant suggests listing title, category, and price band from item photos (vision-language model + embedding search over comparables), with human-editable suggestions and acceptance-rate metrics; deployed on AWS via Terraform, Playwright e2e in CI

**Interview lines:** Mercari — "I rebuilt your core loop and then added the AI feature your product actually ships." HENNGE — "Your product is the thing I built from RFCs; ask me where I got it wrong the first time." Both get the outbox, the invariants, and the honest-limitations framing.

**Sequence:** apply to both **this week** with current materials (Tally flagship). Ship Phase 1 → mention in HENNGE HR interview. Ship Phase 2 → email Mercari recruiter an update. Ship Phase 3–4 → refresh CV/portfolio for TikTok (Sept), Shopee GDP (Dec), Rakuten 2028 (autumn).

---

*Spec version 1.0 — July 18, 2026*