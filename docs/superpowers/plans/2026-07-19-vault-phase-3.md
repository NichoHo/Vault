# Vault Phase 3 — AI Assistant + Trust + Security Depth (compact plan, executed same-day)

**Goal (spec §8 Phase 3):** `/sell` suggestion flow (VLM + price band from comparables), acceptance-rate metric on admin, trust scoring + review queue, TOTP MFA + refresh rotation with reuse detection.

## Decisions

- **assist** is Python/FastAPI on :8084, schema `assist` (suggestions, risk_scores, consumed_events, comparables). JWT-verified via the IdP's JWKS (PyJWT), admin endpoints gated by `ADMIN_EMAILS` claim check (`ponytail:` real roles later).
- **VLM**: Anthropic API (`claude-opus-4-8`, structured outputs via `output_config.format`, image-by-URL) when `ANTHROPIC_API_KEY` is set; graceful heuristic fallback otherwise so the demo works offline.
- **Price band**: 25th–75th percentile over FTS word-overlap matches against a synthetic `comparables` table (self-seeded on boot). `ponytail:` swap for pgvector embeddings when a real embedding source exists.
- **Trust scoring**: pure rule functions (new-account high-value listing 0.8, rapid listing 0.6, new-account buyer 0.5) consuming `market.outbox` via a 10s poller with a `consumed_events` cursor — the outbox written in Phase 2 gets its first consumer. `ponytail:` IsolationForest + Redpanda consumer are the upgrade path.
- **market** now emits `listing.created` to its outbox (same tx as the insert).
- **TOTP** (id service): hand-rolled RFC 6238/4226 (verified against RFC vectors), ±1 step skew, pending-MFA sessions (`sessions.pending_mfa`), 8 single-use recovery codes (sha256-stored), enroll/activate/disable + login/totp + login/recovery endpoints, all audited. QR enrollment deferred — manual key entry works in every authenticator.
- **Refresh rotation** (id service): rotating refresh tokens (sha256-stored, 30d), family revocation on reuse (RFC 6819), `grant_type=refresh_token`, audit `refresh.reuse_detected`. Web refreshes transparently in `middleware.ts`.
- **web**: SellForm with AI-suggested fields (indigo left border until edited — spec §6 co-creation cue), per-field acceptance reporting; `/auth/mfa` enrollment + TOTP/recovery login step; `/admin` metrics + trust queue.

## Task checklist

- [x] id: TOTP core + RFC-vector tests; MFA endpoints; pending sessions
- [x] id: refresh rotation + reuse detection + tests (mfa_test.go)
- [x] assist: FastAPI service, price band + trust rules + pytest (8 tests)
- [x] market: listing.created outbox event
- [x] web: SellForm suggestions, MFA screens, admin page, refresh middleware
- [x] compose: assist service; CI: assist pytest job
- [ ] end-to-end verification against the full compose stack; README; commits
