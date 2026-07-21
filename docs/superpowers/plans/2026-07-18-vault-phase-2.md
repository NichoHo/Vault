# Vault Phase 2 — Escrow + Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Merpay demo — escrow checkout on a double-entry ledger: buy reserves a listing (15-min TTL), pay funds escrow, ship → confirm releases to the seller (minus 10% platform fee), cancel refunds; wallet page shows balance + own ledger entries; an invariant suite proves the money math.

**Architecture:** New `pay` Go service (:8083, schema `pay`) owns accounts/transfers/entries. `market` owns the order state machine and calls pay **synchronously** with idempotency keys (`fund:<order>`, `release:<order>`, `refund:<order>`) — exactly-once comes from a UNIQUE constraint, not from hope. Domain events are written to per-service `outbox` tables in the same transaction as the state change; the relay + Redpanda land in Phase 3 when `assist` becomes the first consumer (`ponytail:` comment marks this).

**Tech Stack:** unchanged — Go 1.26 stdlib ServeMux, pgx/v5, Postgres 17, Next.js 16.

## Global Constraints

- Money is `int64` minor units, currency `JPY`, single currency (spec §4).
- Every money/auth behavior gets a test that proves it (spec §3). Invariants named by spec §8 Phase 2: **escrow zeroes out on completion; concurrent double-spends fail; timer-vs-manual confirm releases exactly once; race detector clean** (CI runs `-race`).
- Idempotency keys on all transfers (spec §4 pay row); lock ordering on account row locks (spec §4).
- Listing state machine: `draft→active→reserved→sold|withdrawn` (spec §4 market row) — migration extends the Phase 1 CHECK constraint.
- Reservation TTL: 15 minutes (spec §4). Auto-release after `AUTO_RELEASE_AFTER` (default 72h) of `shipped`.
- Platform fee: 10% of price, floor division, taken on release into the `platform` account.
- Trust boundaries: pay's fund/release/refund are internal-only (constant-time `X-Internal-Token` check, token shared with market via env `PAY_INTERNAL_TOKEN`); wallet read + demo deposit require a user JWT (aud `vault`) and act only on the caller's own account (deposit capped ¥100,000/call — demo money).
- DB-backed tests use `TEST_DATABASE_URL`, skip when unset, and drop/recreate their schema (established Phase 1 pattern).

---

### Task 1: Extract shared JWT middleware + pay ledger core with invariant tests

**Files:**
- Create: `internal/authn/authn.go` (move `keyCache` + `requireAuth` + `UserID` from `internal/market/auth.go`, exported: `New(jwksURL, issuer string) *Verifier`, `(*Verifier).Require(next http.HandlerFunc) http.HandlerFunc`, `UserID(ctx) string`)
- Delete: `internal/market/auth.go` (market uses authn)
- Modify: `internal/market/server.go` (Server holds `*authn.Verifier`; `s.requireAuth(...)` → `s.auth.Require(...)`)
- Create: `migrations/pay/001_init.sql`, `internal/pay/ledger.go`, `internal/pay/ledger_test.go`
- Modify: `migrations/embed.go` (`//go:embed id/*.sql market/*.sql pay/*.sql`)

**Schema (pay):**
```sql
CREATE TABLE accounts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type text NOT NULL CHECK (owner_type IN ('user','escrow','platform','external')),
    owner_id   uuid,                       -- null for system singletons
    balance    bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- the double-spend backstop: Postgres refuses a negative user balance
    CONSTRAINT balance_nonneg CHECK (owner_type = 'external' OR balance >= 0)
);
CREATE UNIQUE INDEX accounts_owner_idx ON accounts (owner_type, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'));
CREATE TABLE transfers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key text NOT NULL UNIQUE,
    from_account    uuid NOT NULL REFERENCES accounts(id),
    to_account      uuid NOT NULL REFERENCES accounts(id),
    amount_minor    bigint NOT NULL CHECK (amount_minor > 0),
    currency        text NOT NULL DEFAULT 'JPY',
    kind            text NOT NULL CHECK (kind IN ('deposit','escrow_fund','escrow_release','escrow_refund','fee')),
    reference       text NOT NULL DEFAULT '',
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transfers_reference_idx ON transfers (reference) WHERE reference <> '';
CREATE TABLE entries (
    id           bigserial PRIMARY KEY,
    transfer_id  uuid NOT NULL REFERENCES transfers(id),
    account_id   uuid NOT NULL REFERENCES accounts(id),
    amount_minor bigint NOT NULL,          -- signed; sum per transfer = 0
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entries_account_idx ON entries (account_id, id DESC);
CREATE TABLE outbox (
    id           bigserial PRIMARY KEY,
    at           timestamptz NOT NULL DEFAULT now(),
    topic        text NOT NULL,
    payload      jsonb NOT NULL,
    published_at timestamptz               -- ponytail: relay + Redpanda arrive in Phase 3 with the first consumer
);
```

**Interfaces (ledger.go):**
```go
type Ledger struct{ Pool *pgxpool.Pool }
var ErrInsufficientFunds = errors.New("insufficient funds")
var ErrAlreadySettled = errors.New("order already released or refunded")

func (l *Ledger) AccountFor(ctx, ownerType string, ownerID *string) (accountID string, err error) // get-or-create
func (l *Ledger) Transfer(ctx, TransferReq) (Transfer, error)
type TransferReq struct{ IdempotencyKey, Kind, Reference string; FromType string; FromOwner *string; ToType string; ToOwner *string; Amount int64 }
// Transfer: one tx — lock BOTH account rows FOR UPDATE ordered by account id
// (lock ordering, no deadlocks), insert transfer + two signed entries, update
// both balances. Replay (unique violation on idempotency_key) returns the
// existing transfer, nil error, no side effects. Negative user balance →
// ErrInsufficientFunds (23514 check violation mapped, plus explicit pre-check).
func (l *Ledger) FundEscrow(ctx, orderID, buyerID string, amount int64) (Transfer, error)   // buyer→escrow, key "fund:"+orderID
func (l *Ledger) ReleaseEscrow(ctx, orderID, sellerID string) (Transfer, error)
// looks up the fund transfer by reference "order:"+orderID FOR UPDATE (serializes
// release-vs-refund), rejects if a release/refund already exists (ErrAlreadySettled;
// idempotent replay of the SAME action returns the existing transfer instead),
// escrow→seller amount-fee (key "release:"+orderID) + escrow→platform fee
// (key "release_fee:"+orderID), fee = amount/10
func (l *Ledger) RefundEscrow(ctx, orderID, buyerID string) (Transfer, error)               // escrow→buyer full, key "refund:"+orderID
func (l *Ledger) Deposit(ctx, key, userID string, amount int64) (Transfer, error)           // external→user
func (l *Ledger) Wallet(ctx, userID string) (Wallet, error)                                 // balance + last 50 entries with kind/reference
```

**Invariant tests (ledger_test.go) — write first, watch fail, implement, watch pass:**
```go
// TestDoubleEntry: deposit + fund + release; for every transfer, SUM(entries)==0;
//   global SUM(all entries)==0 (value conservation); account.balance == SUM(entries per account).
// TestIdempotency: same Deposit key twice → same transfer id, one row.
// TestInsufficientFunds: fund more than balance → ErrInsufficientFunds, no rows written.
// TestConcurrentDoubleSpend: balance 10_000; 20 goroutines each FundEscrow 1_000 on
//   DIFFERENT orders; exactly 10 succeed, 10 fail; final balance 0, never negative.
// TestEscrowZeroesOut: fund→release: escrow balance back to 0; seller +90%, platform +10%;
//   fund→refund: escrow 0, buyer whole again. released+refunded == funded per order.
// TestReleaseRefundExclusive: after release, refund → ErrAlreadySettled (and vice versa);
//   concurrent release||refund (2 goroutines, same order) → exactly one settles.
// TestReleaseIdempotentReplay: ReleaseEscrow twice sequentially → same transfer, no double pay.
```

- [ ] Move authn, fix market build, `go test ./internal/market/` still green
- [ ] Write ledger_test.go, `go test ./internal/pay/` fails (no ledger.go)
- [ ] Implement schema + ledger.go, tests pass
- [ ] Commit: `feat(pay): double-entry ledger — idempotent escrow fund/release/refund with invariant suite`

### Task 2: pay HTTP service

**Files:**
- Create: `internal/pay/server.go`, `internal/pay/server_test.go`, `cmd/pay/main.go`
- Modify: `docker-compose.yml` (pay service :8083; `PAY_INTERNAL_TOKEN` env on pay + market; `PAY_URL` on market + web)

**Endpoints:**
- Internal (require `X-Internal-Token`, constant-time compare; 403 otherwise): `POST /internal/escrow/fund {order_id, buyer_id, amount_minor}`, `POST /internal/escrow/release {order_id, seller_id}`, `POST /internal/escrow/refund {order_id, buyer_id}`. 402 `{"error":"insufficient_funds"}` / 409 `{"error":"already_settled"}` mapped from ledger errors.
- User (JWT via `authn.Verifier`): `GET /wallet` (own balance + entries), `POST /deposits {idempotency_key, amount_minor}` (self only, 1..100000).
- `GET /healthz`.

**Tests:** fund without token → 403; deposit over cap → 400; wallet shows deposit entry; full fund→release over HTTP mirrors ledger test (status codes 200/402/409).

- [ ] Test → fail → implement → pass
- [ ] Commit: `feat(pay): HTTP service — internal escrow ops, JWT wallet + demo deposits`

### Task 3: market — orders, reservations, sweeps

**Files:**
- Create: `migrations/market/002_orders.sql`, `internal/market/orders.go`, `internal/market/orders_test.go`, `internal/market/payclient.go`
- Modify: `internal/market/server.go` (routes + Server gains `pay *PayClient`), `cmd/market/main.go` (PAY_URL/PAY_INTERNAL_TOKEN/AUTO_RELEASE_AFTER envs, start sweeper goroutine)

**Migration 002:**
```sql
ALTER TABLE listings DROP CONSTRAINT listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('draft','active','reserved','sold','withdrawn'));
CREATE TABLE orders (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id   uuid NOT NULL REFERENCES listings(id),
    buyer_id     uuid NOT NULL,
    seller_id    uuid NOT NULL,
    price_minor  bigint NOT NULL,
    status       text NOT NULL DEFAULT 'pending_payment' CHECK (status IN
                 ('pending_payment','funded','shipped','completed','cancelled','refunded')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    funded_at    timestamptz, shipped_at timestamptz, completed_at timestamptz
);
CREATE INDEX orders_buyer_idx ON orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller_idx ON orders (seller_id, created_at DESC);
CREATE TABLE reservations (
    order_id   uuid PRIMARY KEY REFERENCES orders(id),
    listing_id uuid NOT NULL REFERENCES listings(id),
    expires_at timestamptz NOT NULL
);
CREATE TABLE outbox (
    id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
    topic text NOT NULL, payload jsonb NOT NULL, published_at timestamptz
);
```

**State machine (orders.go):** every transition is one tx with `SELECT … FOR UPDATE` on the order (and listing where it changes) + status guard in the WHERE clause + outbox event (`order.created|funded|shipped|completed|cancelled|refunded`):
- `POST /orders {listing_id}` (auth): listing FOR UPDATE, must be `active`, buyer ≠ seller → listing `reserved`, order `pending_payment`, reservation now()+15m. 409 if not active.
- `POST /orders/{id}/pay` (buyer): guard `pending_payment` → pay.Fund (402 passthrough) → order `funded`, listing `sold`, reservation deleted.
- `POST /orders/{id}/ship` (seller): `funded`→`shipped`.
- `POST /orders/{id}/confirm` (buyer): `shipped`→ pay.Release → `completed`. Release is idempotent at pay, so a crash between release and the status update is retry-safe.
- `POST /orders/{id}/cancel`: buyer or seller on `pending_payment` (listing back to `active`); seller only on `funded` → pay.Refund → `refunded`, listing back to `active`.
- `GET /orders?role=buyer|seller`, `GET /orders/{id}` (participants only, joined with listing title/image).
- `SweepReservations(ctx)`: expired `pending_payment` orders → cancelled, listings re-activated, reservations deleted (single tx). `SweepAutoRelease(ctx)`: `shipped` older than cutoff → same release path as confirm. Both run in a 30s ticker goroutine; both callable directly from tests.

**PayClient (payclient.go):** `Fund(ctx, orderID, buyerID string, amount int64) error`, `Release(ctx, orderID, sellerID string) error`, `Refund(ctx, orderID, buyerID string) error` — POST with X-Internal-Token; maps 402→`ErrInsufficientFunds`, 409→`ErrAlreadySettled`.

**Tests (orders_test.go)** — spins the real pay server via `httptest` on the same test DB (pay schema migrated too), wires market at it:
```go
// TestOrderHappyPath: seed listing+deposit; create order → listing reserved;
//   pay → funded, listing sold, buyer balance -price; ship → shipped;
//   confirm → completed, seller +90%, platform +10%, escrow 0.
// TestConcurrentBuy: 2 goroutines POST /orders on same listing → exactly one 201.
// TestPayInsufficient: broke buyer → 402, order stays pending_payment.
// TestTimerVsManualConfirm: shipped order; run confirm handler and SweepAutoRelease
//   concurrently → exactly ONE escrow_release transfer in pay; order completed.
// TestReservationExpiry: backdate reservation, SweepReservations → order cancelled,
//   listing active again.
// TestCancelFunded: seller cancels funded order → refunded, buyer whole, escrow 0.
// TestStrangerCannotAct: third user pay/ship/confirm/view → 403/404.
```

- [ ] Tests → fail → implement → pass; `gofmt`, `go vet`
- [ ] Commit: `feat(market): order state machine, reservations with TTL, escrow via pay`

### Task 4: web — buy, checkout, orders, wallet

**Files:**
- Create: `web/app/checkout/[orderId]/page.tsx`, `web/app/orders/page.tsx`, `web/app/orders/[id]/page.tsx`, `web/app/wallet/page.tsx`, `web/components/OrderTimeline.tsx`
- Modify: `web/lib/api.ts` (Order/Wallet types + fetchers with Bearer), `web/lib/env.ts` (+`PAY_URL`), `web/app/listing/[id]/page.tsx` (real Buy button → server action POST /orders → redirect checkout), `web/app/layout.tsx` (Wallet + Orders nav links when signed in)

**Pages:**
- `/checkout/[orderId]`: listing summary, price, wallet balance, reservation countdown note; **Pay** server action → `/orders/{id}/pay`; insufficient funds → error banner + "Add ¥50,000 demo funds" button (server action → pay `POST /deposits` with key `topup:<user>:<timestamp-minute>`), Cancel action.
- `/orders`: Purchases / Sales tabs (`?role=`), status badges (Ishidatami state-color map: funded=kohaku, shipped=indigo, completed=moss, cancelled/refunded=sumi).
- `/orders/[id]`: `OrderTimeline` (created → funded → shipped → completed timestamps), role-appropriate buttons: buyer Pay (pending) / Confirm receipt (shipped); seller Ship (funded) / Cancel & refund (funded); both Cancel (pending).
- `/wallet`: big tabular-nums balance, entry list (kind label, signed amount colored moss/torii, order reference link, date), demo top-up button.

- [ ] `npm run build` clean; browser round trip on dev server
- [ ] Commit: `feat(web): checkout, orders with escrow timeline, wallet`

### Task 5: seed, compose, README, end-to-end verify

**Files:**
- Modify: `cmd/seed/main.go` (deposits: alice + bob ¥100,000 each, keys `seed:deposit:<handle>`, via pay ledger direct), `docker-compose.yml` (already touched Task 2 — verify), `README.md` (architecture diagram + services table + What-the-tests-prove additions + roadmap shift), `.github/workflows/ci.yml` (nothing — `go test ./...` already covers new packages)

- [ ] Full stack: `docker compose up --build -d`, reset schemas, seed
- [ ] Browser: sign in as bob → buy alice's listing → pay → sign in as alice → ship → back to bob → confirm → wallets: bob -price, alice +90%; escrow zero (check via SQL)
- [ ] `TEST_DATABASE_URL=… go test ./...` all green; re-seed after
- [ ] Commit: `feat: phase 2 complete — escrow checkout demo (docs + seed)`

## Self-Review (done)

- **Spec coverage §8 Phase 2:** fund/release/refund ✓(T1-2) · order state machine ✓(T3) · reservation TTL ✓(T3) · wallet page ✓(T4) · invariants: escrow zeroes ✓(T1), concurrent double-spends ✓(T1), timer-vs-manual exactly once ✓(T3), race clean ✓(CI -race over new concurrent tests).
- **Deferrals:** outbox relay + Redpanda + chaos test → Phase 3 (first consumer = assist); gateway/gRPC still unneeded — market→pay is one internal HTTP client behind an interface-free struct (`ponytail:` noted in payclient.go).
- **Type consistency:** `ErrInsufficientFunds`/`ErrAlreadySettled` defined in T1, mapped in T2 (HTTP 402/409), unmapped back in T3 client; `authn.Verifier.Require` used by market (T1) and pay (T2).
