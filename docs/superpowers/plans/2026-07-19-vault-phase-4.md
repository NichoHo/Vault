# Vault Phase 4 — Ship It + OSS Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the transactional-outbox relay + idempotent-consumer into a standalone, publishable Go module (`outboxkit`) that Vault imports; make the event bus real (Postgres outbox → outboxkit relay → Redpanda → consumers) with a chaos test proving no lost/duplicated events; add Playwright e2e, OpenAPI, DESIGN.md, real Terraform, and the three engineering write-ups.

**Architecture:** `outboxkit` is its own Go module (`github.com/NichoHo/outboxkit`) living at `outboxkit/` with its own `go.mod`, MIT license, tests, and CI; Vault's root module pulls it via a `replace` directive so the monorepo builds while the module stays independently versioned/publishable. The relay drains a `<schema>.outbox` table through a `Publisher` interface (broker-free core; a `kafkapub` subpackage wraps franz-go for Redpanda). `market` and `pay` run the relay as a goroutine; `assist` consumes `market.events` from Redpanda, deduping via its existing `consumed_events` table. The chaos invariant is proven broker-free in outboxkit's own suite.

**Tech Stack:** Go 1.26 (`github.com/twmb/franz-go` for Kafka), Redpanda (Kafka-compatible), Python `kafka-python` in assist, Playwright (`@playwright/test`) in web, Terraform (AWS provider ~> 6.0), OpenAPI 3.1.

## Global Constraints

- `outboxkit` module path `github.com/NichoHo/outboxkit` (matches the CV GitHub handle in spec §11); MIT license; semver-tagged `v0.1.0`; godoc on every exported symbol; README with usage + CI badge; CONTRIBUTING.md; 2–3 good-first-issues (spec §10.1).
- At-least-once delivery is the relay contract; consumers achieve exactly-once *effects* via idempotency keyed on the outbox row id (spec §4 outbox paragraph).
- Chaos test (spec §9): "kill the outbox relay mid-flow, prove no lost/duplicated events." Deterministic and broker-free so CI runs it with `-race`.
- Playwright e2e happy path (spec §8 Phase 4): register → MFA → AI-assisted listing → buy → confirm → wallet reconciles.
- Money stays `int64` minor units, JPY; every money/auth behavior keeps its test (spec §3).
- Redpanda must not break `docker compose up`: consumers retry the broker with backoff instead of crashing at boot.
- Go tests run with `-p 1` (packages share the dev DB and drop/recreate schemas). Docker preflight: if `docker info` fails, STOP and tell the user (standing rule).
- Deferred with a `ponytail:` comment and named in the README limitations, not silently dropped: the 3-minute demo GIF (needs manual screen capture) and `terraform apply` (needs the user's AWS credentials).

---

### Task 1: `outboxkit` standalone module — relay, idempotent consumer, chaos test, OSS packaging

**Files:**
- Create: `outboxkit/go.mod`, `outboxkit/outboxkit.go` (Message, Publisher, Relay, Idempotent), `outboxkit/outboxkit_test.go` (unit + chaos), `outboxkit/LICENSE` (MIT), `outboxkit/README.md`, `outboxkit/CONTRIBUTING.md`, `outboxkit/.github/workflows/ci.yml`, `outboxkit/docs/good-first-issues.md`, `outboxkit/kafkapub/kafkapub.go` (franz-go Publisher, separate subpackage so the core has no broker dep).

**Interfaces (Produces — market/pay/assist and later tasks rely on these exact signatures):**
```go
package outboxkit

type Message struct {
	ID      int64
	Topic   string
	Payload []byte
}

// Publisher delivers a batch to a sink. Must be all-or-nothing per call from
// the relay's perspective: return an error and the whole batch is retried.
type Publisher interface {
	Publish(ctx context.Context, msgs []Message) error
}

// Relay drains <Schema>.outbox to Publisher, marking published_at. At-least-once:
// a crash after Publish succeeds but before COMMIT re-publishes on the next drain.
type Relay struct {
	Pool    *pgxpool.Pool
	Schema  string
	Pub     Publisher
	Batch   int           // default 100
	Poll    time.Duration // default 1s
	Logger  *slog.Logger  // default slog.Default()
}
func (r *Relay) DrainOnce(ctx context.Context) (int, error) // one batch; returns rows published
func (r *Relay) Run(ctx context.Context)                    // loop until ctx cancelled

// Idempotent runs a consumer side-effect at most once per (Source, eventID),
// recording the id in <Schema>.consumed_events in the SAME tx as the effect.
type Idempotent struct {
	Pool   *pgxpool.Pool
	Schema string
	Source string
}
func (i *Idempotent) Guard(ctx context.Context, eventID int64, effect func(pgx.Tx) error) (applied bool, err error)
```

`DrainOnce` body: `BEGIN` → `SELECT id, topic, payload FROM <schema>.outbox WHERE published_at IS NULL ORDER BY id LIMIT $batch FOR UPDATE SKIP LOCKED` → `Pub.Publish(msgs)` (on error `ROLLBACK`, rows stay unpublished) → `UPDATE <schema>.outbox SET published_at = now() WHERE id = ANY($ids)` → `COMMIT`. `SKIP LOCKED` lets multiple relays run without blocking; duplicate publishes across relays are the consumer's job to dedup.

`Guard` body: `BEGIN` → `INSERT INTO <schema>.consumed_events (source, event_id) VALUES ($source, $id) ON CONFLICT DO NOTHING` → if 0 rows affected `ROLLBACK, return false` → else run `effect(tx)` → `COMMIT, return true`.

- [ ] **Step 1: Init module + write the chaos test first (broker-free, deterministic).**

`outboxkit/go.mod`:
```
module github.com/NichoHo/outboxkit

go 1.26

require github.com/jackc/pgx/v5 v5.10.0
```

`outboxkit/outboxkit_test.go` (needs `TEST_DATABASE_URL`; creates a throwaway schema `obk_test`):
```go
package outboxkit

// helper newTestSchema(t) drops+creates schema obk_test with outbox + consumed_events
// tables (bigserial id, topic text, payload jsonb, published_at timestamptz;
// consumed_events(source text, event_id bigint, primary key(source,event_id))).

// flakyPublisher records every message it is handed, and returns an error on the
// Nth call — simulating a relay that published a batch then died before COMMIT.
type flakyPublisher struct {
	mu       sync.Mutex
	got      []Message
	failOn   int // 1-indexed call number to fail; 0 = never
	calls    int
}
func (p *flakyPublisher) Publish(ctx context.Context, msgs []Message) error {
	p.mu.Lock(); defer p.mu.Unlock()
	p.calls++
	p.got = append(p.got, msgs...) // records even on the failing call (mid-flow crash)
	if p.calls == p.failOn { return errors.New("relay crashed mid-flow") }
	return nil
}

func TestChaosNoLostNoDuplicateEffects(t *testing.T) {
	pool := newTestSchema(t)
	// seed 25 events
	for i := 0; i < 25; i++ {
		pool.Exec(ctx, `INSERT INTO obk_test.outbox (topic, payload) VALUES ('order.created', '{}')`)
	}
	pub := &flakyPublisher{failOn: 2} // crash on the 2nd batch, mid-flow
	r := &Relay{Pool: pool, Schema: "obk_test", Pub: pub, Batch: 10}

	// drain until the table is empty, tolerating the injected crash
	for {
		n, err := r.DrainOnce(ctx)
		if err != nil { continue } // relay "restarts" and retries — at-least-once
		if n == 0 { break }
	}

	// NO LOSS: every distinct event id reached the publisher at least once
	delivered := map[int64]int{}
	for _, m := range pub.got { delivered[m.ID]++ }
	if len(delivered) != 25 { t.Fatalf("lost events: %d of 25 delivered", len(delivered)) }

	// NO DUPLICATE EFFECTS: an Idempotent consumer applies each id exactly once
	// even though the crash caused re-delivery
	idem := &Idempotent{Pool: pool, Schema: "obk_test", Source: "obk_test"}
	effects := 0
	for _, m := range pub.got {
		applied, err := idem.Guard(ctx, m.ID, func(tx pgx.Tx) error { return nil })
		if err != nil { t.Fatal(err) }
		if applied { effects++ }
	}
	if effects != 25 { t.Fatalf("duplicate effects: %d applies for 25 events", effects) }

	// and the batch that "crashed" really was re-delivered (proves the scenario ran)
	if len(pub.got) <= 25 { t.Fatalf("crash did not cause re-delivery; got %d", len(pub.got)) }
}
```
Also `TestDrainMarksPublished` (happy path: all rows get `published_at`), `TestGuardDedup` (same id twice → applied true then false, effect runs once), `TestPublisherErrorLeavesRowsUnpublished`.

- [ ] **Step 2: Run tests, watch them fail** (`cd outboxkit && TEST_DATABASE_URL=… go test ./...` → FAIL: undefined Relay/Idempotent).
- [ ] **Step 3: Implement `outboxkit/outboxkit.go`** with the bodies above.
- [ ] **Step 4: Run tests green**, `gofmt`, `go vet`.
- [ ] **Step 5: `outboxkit/kafkapub/kafkapub.go`** — `New(brokers []string) (*Publisher, error)` wrapping `kgo.Client`; `Publish` produces one record per message (`Key = itoa(ID)`, `Topic = msg.Topic`, `Value = msg.Payload`) and waits for acks. Its own `require github.com/twmb/franz-go`. `go build ./...` in the module.
- [ ] **Step 6: OSS packaging** — MIT LICENSE (year 2026, holder "Nicholas Ho"); README (what/why, install `go get github.com/NichoHo/outboxkit`, a 20-line relay example + a Guard example, CI badge `![CI](https://github.com/NichoHo/outboxkit/actions/workflows/ci.yml/badge.svg)`, "at-least-once + idempotent = exactly-once effects" explainer); CONTRIBUTING.md (build/test, `TEST_DATABASE_URL`, PR checklist); `docs/good-first-issues.md` (3 issues: Kafka headers for tracing, a `retention` sweeper for published rows, a `metrics` hook); `.github/workflows/ci.yml` (Go + Postgres service, `go test -race`).
- [ ] **Step 7: Commit** `feat(outboxkit): extract transactional-outbox relay + idempotent consumer as a standalone module`.

### Task 2: Vault imports `outboxkit`; market + pay run the relay to Redpanda; assist consumes

**Files:**
- Modify: `go.mod` (add `require github.com/NichoHo/outboxkit v0.1.0` + `replace github.com/NichoHo/outboxkit => ./outboxkit`), `go.sum`
- Create: `internal/events/events.go` (topic names + a `Relay` wiring helper shared by market & pay)
- Modify: `cmd/market/main.go`, `cmd/pay/main.go` (start an `outboxkit.Relay` goroutine when `REDPANDA_BROKERS` is set), `docker-compose.yml` (add `redpanda` service; `REDPANDA_BROKERS=redpanda:9092` on market/pay/assist; depends_on redpanda)
- Modify: `assist/requirements.txt` (+`kafka-python==2.0.*`), `assist/app/consumer.py` (Kafka consumer → existing trust rules), `assist/app/main.py` (start the Kafka consumer instead of the Postgres poller), `assist/app/trust.py` (keep the pure rule functions + `_process_event`; drop `start_poller`/`poll_once` or leave them behind a `ponytail:` note for offline use)

**Interfaces:**
- Consumes: `outboxkit.Relay`, `outboxkit.kafkapub.New` (Task 1).
- Produces: topics `market.events`, `pay.events`; Kafka message shape `{key: outbox_id, value: outbox payload json, topic: outbox topic}`.

`internal/events/events.go`:
```go
package events

// StartRelay runs an outboxkit relay for one schema in the background when
// brokers is non-empty. No-op otherwise (dev without Redpanda still boots).
func StartRelay(ctx context.Context, pool *pgxpool.Pool, schema, brokers string) error {
	if brokers == "" { slog.Warn("REDPANDA_BROKERS unset; outbox relay disabled", "schema", schema); return nil }
	pub, err := kafkapub.New(strings.Split(brokers, ","))
	if err != nil { return err }
	r := &outboxkit.Relay{Pool: pool, Schema: schema, Pub: pub}
	go r.Run(ctx)
	return nil
}
```
Note: the relay publishes `<schema>.outbox` rows to topics named by each row's `topic` column (e.g. `listing.created`) — but assist subscribes per Vault topic. Simplify: kafkapub publishes every message to a single topic per schema (`market.events`) with the domain topic in a header/key; assist filters on the payload/header. To keep assist's rule dispatch working, carry the domain topic. Set `kafkapub` record `Topic = schema+".events"`, and add a Kafka header `domain-topic: <msg.Topic>`. Adjust `kafkapub.Publish` to take the stream topic; wire `StartRelay` to pass `schema+".events"`. (Update Task 1 Step 5 `kafkapub.New` to `New(brokers []string, streamTopic string)` and set the header — reflected here so the signatures match.)

`assist/app/consumer.py`:
```python
# Consumes market.events from Redpanda, dispatches to the existing trust rules,
# dedupes via assist.consumed_events (idempotent — the Python analog of
# outboxkit.Idempotent.Guard). Retries the broker with backoff so a cold
# Redpanda does not crash the service.
def start_consumer(pool, brokers: str) -> None:
    def loop():
        consumer = None
        while consumer is None:
            try:
                consumer = KafkaConsumer("market.events", bootstrap_servers=brokers,
                    group_id="assist-trust", enable_auto_commit=True,
                    auto_offset_reset="earliest",
                    value_deserializer=lambda b: json.loads(b))
            except NoBrokersAvailable:
                time.sleep(3)
        for record in consumer:
            topic = next((v.decode() for k, v in (record.headers or []) if k == "domain-topic"), "")
            event_id = int(record.key.decode()) if record.key else record.offset
            with pool.connection() as conn, conn.transaction():
                # INSERT consumed_events ON CONFLICT DO NOTHING; if inserted, apply rules
                trust.consume(conn, event_id, topic, record.value)
    threading.Thread(target=loop, daemon=True, name="assist-consumer").start()
```
Add `trust.consume(conn, event_id, topic, payload)` = the guarded body currently inside `_process_event` (insert consumed_events; on conflict skip; else score). Keep `_process_event` scoring logic.

**Verification:** `docker compose up --build -d`; reset schemas; seed; list an item on a new account; `docker compose exec db psql -c "SELECT count(*) FROM market.outbox WHERE published_at IS NOT NULL"` > 0 (relay ran); `docker compose exec db psql -c "SELECT count(*) FROM assist.risk_scores"` grows (consumer ran end-to-end through Redpanda). `docker compose logs redpanda` clean.
- [ ] Tests/build green (`go build ./...`, `go vet`, assist import check); manual compose verification above.
- [ ] Commit `feat: wire outboxkit relay to Redpanda; assist consumes market.events`.

### Task 3: Playwright e2e — register → MFA → AI listing → buy → confirm → wallet reconciles

**Files:**
- Create: `web/e2e/happy-path.spec.ts`, `web/e2e/totp.ts` (tiny TOTP generator so the test can pass the MFA step), `web/playwright.config.ts`
- Modify: `web/package.json` (devDep `@playwright/test`, script `"e2e": "playwright test"`), `.github/workflows/ci.yml` (optional e2e job gated on the stack — leave a documented `ponytail:` note that e2e runs against a live compose stack, not in the unit CI)

`web/e2e/totp.ts`: RFC 6238 generator (HMAC-SHA1, 30s, 6 digits) using Node `crypto`, mirroring `internal/id/totp.go`, so the test computes the same code the IdP expects.

`web/e2e/happy-path.spec.ts` (against `baseURL http://localhost:3000`, stack already up):
```ts
// seller = random email; buyer = seeded bob (has ¥100,000).
// 1. register seller → /sell → type a title hint → ✨ Suggest → price band fills →
//    override price to 5000 (≤ bob's balance) → List it → lands on /listing/{id}.
// 2. seller → /auth/mfa → Enable → read the secret from the page → compute code with
//    totp.ts → Confirm → recovery codes shown. Sign out. Sign in → assert the TOTP
//    step-up appears → enter a fresh code → signed in. (proves MFA gate)
// 3. sign out; sign in as bob (password123!) → open the seller's listing → Buy →
//    checkout shows wallet ≥ price → Pay → order funded.
// 4. sign out; sign in as seller → /orders?role=seller → Mark as shipped.
// 5. sign out; sign in as bob → /orders → Confirm receipt.
// 6. bob /wallet shows −5000 vs a pre-buy snapshot; seller /wallet shows +4500 (90%).
```
Use unique emails per run (`seller-${Date.now()}@vault.test`) so reruns don't collide. Seeded bob's MFA stays off (only the fresh seller enrolls), so bob's login is single-step.

**Verification:** stack up + seeded → `cd web && npx playwright install chromium && npm run e2e` → 1 passed. Screenshot on failure via Playwright's trace.
- [ ] e2e green against the live stack.
- [ ] Commit `test(web): Playwright happy-path e2e — register, MFA, AI listing, escrow buy, wallet reconcile`.

### Task 4: OpenAPI spec + DESIGN.md

**Files:**
- Create: `docs/openapi.yaml` (OpenAPI 3.1 covering id, market, pay, assist REST surfaces — the endpoints already implemented; `bearerAuth` security scheme; request/response schemas for Listing, Order, Wallet, Suggestion, RiskScore, the OIDC token/authorize/mfa endpoints)
- Create: `DESIGN.md` (Ishidatami design system per spec §6: the color table with hex + usage, type scale + fonts, 4px grid/radii, the component list incl. SuggestionField's indigo left-border co-creation cue, motion timings, "no dark mode" note; reference the actual token definitions in `web/app/globals.css`)

**Verification:** `npx @redocly/cli lint docs/openapi.yaml` (or `npx @stoplight/spectral-cli lint`) → no errors; DESIGN.md renders and its hex values match `web/app/globals.css`.
- [ ] OpenAPI lints clean; DESIGN.md written.
- [ ] Commit `docs: OpenAPI 3.1 spec + Ishidatami DESIGN.md`.

### Task 5: Real Terraform (replace the stub) + fmt/validate

**Files:**
- Modify: `deploy/terraform/main.tf` (keep provider block); Create: `deploy/terraform/network.tf` (default VPC data source + a security group opening 22/80/3000), `deploy/terraform/instance.tf` (one `t3.small` EC2 running the stack via `user_data` that installs Docker + `docker compose up`, cloning the repo or pulling images), `deploy/terraform/variables.tf` (`region`, `key_name`, `repo_url`), `deploy/terraform/outputs.tf` (`public_dns`), `deploy/terraform/README.md` (apply steps, cost note, "needs your AWS creds — not applied here")

Single small instance (spec §8 "small instance or ECS free tier") is the lazier honest choice than ECS for a demo; `user_data` runs `git clone $repo_url && docker compose up -d`. Mark with a `ponytail:` note: single instance, no ASG/ALB/RDS — swap in ECS+RDS if the demo needs HA.

**Verification:** `cd deploy/terraform && terraform fmt -check && terraform validate` (validate needs `terraform init` which downloads the provider; if the sandbox blocks network, run `terraform fmt -check` and hand-review, noting validate requires init). No `apply` (needs creds).
- [ ] `terraform fmt` clean; `validate` clean if init succeeds, else fmt + documented.
- [ ] Commit `feat(deploy): Terraform for a single-instance AWS deploy`.

### Task 6: Three engineering write-ups + README/architecture polish + demo note

**Files:**
- Create: `docs/writeups/01-oidc-from-the-rfcs.md`, `docs/writeups/02-transactional-outbox-in-practice.md`, `docs/writeups/03-what-my-tests-prove.md` (each ~1,500 words, concrete, with code pulled from the real repo — spec §10.2)
- Modify: `README.md` (final architecture diagram now showing Redpanda live + outboxkit; add an "OSS: outboxkit" section linking `outboxkit/`; add e2e/OpenAPI/DESIGN/Terraform to the layout; "honest limitations" gets the demo-GIF + terraform-apply caveats; a "Phase 4 done" line), `docs/writeups/README.md` (index)

The three posts:
1. **OIDC from the RFCs** — PKCE S256, the atomic single-use auth code (`UPDATE … WHERE used_at IS NULL`), RS256/JWKS, refresh rotation + reuse detection (family revocation), what I got wrong first (e.g. non-atomic code consumption, alg confusion). Code from `internal/id`.
2. **The transactional outbox in practice** — the dual-write problem, outbox in the same tx as the state change, the relay (`FOR UPDATE SKIP LOCKED`), at-least-once + idempotent consumer = exactly-once effects, the chaos test. Doubles as outboxkit docs. Code from `outboxkit`.
3. **What my tests prove** — invariant testing for money: double-entry sums to zero, concurrent double-spends, escrow zeroes out, timer-vs-manual exactly-once. Code from `internal/pay`.

**Verification:** each post ≥ 1,200 words, contains ≥ 2 real code blocks from the repo, no TODO/placeholder; README architecture diagram matches the running services; `docker compose up` clean from scratch.
- [ ] Posts written; README final; full stack boots clean from a fresh `make down && make up`.
- [ ] Commit `docs: phase 4 write-ups, README architecture + honest limitations`.

## Self-Review (done)

- **Spec coverage §8 Phase 4:** outboxkit extraction+publication → T1; AWS Terraform → T5; seeded live demo → existing seed (+Terraform user_data); Playwright e2e → T3; README architecture + "what the tests prove" + limitations → T6; DESIGN.md → T4; OpenAPI → T4; 3-min demo GIF → deferred with README note (needs manual capture). **§9:** chaos test → T1; Playwright happy path → T3; (OIDC misuse, escrow invariants, `-race` already exist Phases 1–3). **§10.1 outboxkit** (semver, godoc, README, CI badge, MIT, CONTRIBUTING, good-first-issues) → T1; **§10.2 three write-ups** → T6; **§10.3 talk** → out of scope for code (a slide deck could live in `docs/talk/`, noted but not built).
- **Deferrals (honest, in README):** demo GIF (manual capture), `terraform apply` (user's AWS creds), §10.3 community talk (a human act). outboxkit lives as a monorepo submodule via `replace`; README notes mirror-publishing to its own repo for real tags.
- **Type consistency:** `outboxkit.Relay{Pool,Schema,Pub,Batch,Poll,Logger}`, `Idempotent.Guard(ctx,id,effect)→(bool,error)`, `kafkapub.New(brokers,streamTopic)` are defined in T1 and consumed unchanged in T2 (`events.StartRelay`) and mirrored by assist's Python `trust.consume`. Topic scheme `<schema>.events` + `domain-topic` header is fixed in T2 and read by assist's consumer.
