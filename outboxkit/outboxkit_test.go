package outboxkit

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const schema = "obk_test"

func newTestSchema(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	_, err = pool.Exec(ctx, `DROP SCHEMA IF EXISTS `+schema+` CASCADE;
		CREATE SCHEMA `+schema+`;
		CREATE TABLE `+schema+`.outbox (
			id bigserial PRIMARY KEY, topic text NOT NULL,
			payload jsonb NOT NULL, published_at timestamptz);
		CREATE TABLE `+schema+`.consumed_events (
			source text NOT NULL, event_id bigint NOT NULL,
			PRIMARY KEY (source, event_id));`)
	if err != nil {
		t.Fatal(err)
	}
	return pool
}

func seed(t *testing.T, pool *pgxpool.Pool, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		if _, err := pool.Exec(context.Background(),
			`INSERT INTO `+schema+`.outbox (topic, payload) VALUES ('order.created', '{}')`); err != nil {
			t.Fatal(err)
		}
	}
}

func unpublished(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM `+schema+`.outbox WHERE published_at IS NULL`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// recordingPublisher records every message it is handed. failOn (1-indexed) is
// the Publish call number that returns an error AFTER recording — simulating a
// relay that published a batch to the broker and then died before COMMIT.
type recordingPublisher struct {
	mu     sync.Mutex
	got    []Message
	calls  int
	failOn int
}

func (p *recordingPublisher) Publish(_ context.Context, msgs []Message) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls++
	p.got = append(p.got, msgs...)
	if p.calls == p.failOn {
		return errors.New("relay crashed mid-flow")
	}
	return nil
}

// TestChaosNoLostNoDuplicateEffects is the spec §9 chaos invariant: kill the
// relay mid-flow and prove no lost and no duplicated events (effects).
func TestChaosNoLostNoDuplicateEffects(t *testing.T) {
	ctx := context.Background()
	pool := newTestSchema(t)
	const total = 25
	seed(t, pool, total)

	pub := &recordingPublisher{failOn: 2} // 2nd batch publishes then "crashes"
	r := &Relay{Pool: pool, Schema: schema, Pub: pub, Batch: 10}

	// Drain until the table empties, tolerating the injected crash the way a
	// supervised relay would: on error it just tries again.
	for {
		n, err := r.DrainOnce(ctx)
		if err != nil {
			continue // relay "restarts"
		}
		if n == 0 {
			break
		}
	}

	// NO LOSS: every distinct event id reached the publisher at least once.
	delivered := map[int64]int{}
	for _, m := range pub.got {
		delivered[m.ID]++
	}
	if len(delivered) != total {
		t.Fatalf("lost events: %d of %d distinct ids delivered", len(delivered), total)
	}
	if unpublished(t, pool) != 0 {
		t.Fatalf("rows left unpublished: %d", unpublished(t, pool))
	}

	// The crash must actually have caused re-delivery, or the test proves nothing.
	if len(pub.got) <= total {
		t.Fatalf("crash did not cause re-delivery: %d deliveries for %d events", len(pub.got), total)
	}

	// NO DUPLICATE EFFECTS: an Idempotent consumer applies each id exactly once,
	// even though the crash re-delivered a batch.
	idem := &Idempotent{Pool: pool, Schema: schema, Source: schema}
	effects := 0
	for _, m := range pub.got {
		applied, err := idem.Guard(ctx, m.ID, func(pgx.Tx) error { return nil })
		if err != nil {
			t.Fatal(err)
		}
		if applied {
			effects++
		}
	}
	if effects != total {
		t.Fatalf("duplicate effects: %d applies for %d events", effects, total)
	}
}

func TestDrainMarksPublished(t *testing.T) {
	ctx := context.Background()
	pool := newTestSchema(t)
	seed(t, pool, 5)
	pub := &recordingPublisher{}
	r := &Relay{Pool: pool, Schema: schema, Pub: pub}

	n, err := r.DrainOnce(ctx)
	if err != nil || n != 5 {
		t.Fatalf("drain: n=%d err=%v", n, err)
	}
	if unpublished(t, pool) != 0 {
		t.Fatal("rows not marked published")
	}
	// a second drain finds nothing
	if n, _ := r.DrainOnce(ctx); n != 0 {
		t.Fatalf("second drain published %d", n)
	}
	if len(pub.got) != 5 {
		t.Fatalf("publisher saw %d messages", len(pub.got))
	}
}

func TestPublisherErrorLeavesRowsUnpublished(t *testing.T) {
	ctx := context.Background()
	pool := newTestSchema(t)
	seed(t, pool, 3)
	pub := &recordingPublisher{failOn: 1}
	r := &Relay{Pool: pool, Schema: schema, Pub: pub}

	if _, err := r.DrainOnce(ctx); err == nil {
		t.Fatal("expected publish error")
	}
	if unpublished(t, pool) != 3 {
		t.Fatalf("rows should stay unpublished on publish error, got %d unpublished", unpublished(t, pool))
	}
}

func TestGuardDedup(t *testing.T) {
	ctx := context.Background()
	pool := newTestSchema(t)
	idem := &Idempotent{Pool: pool, Schema: schema, Source: "s"}

	runs := 0
	effect := func(pgx.Tx) error { runs++; return nil }

	applied, err := idem.Guard(ctx, 42, effect)
	if err != nil || !applied {
		t.Fatalf("first guard: applied=%v err=%v", applied, err)
	}
	applied, err = idem.Guard(ctx, 42, effect)
	if err != nil || applied {
		t.Fatalf("second guard: want applied=false, got applied=%v err=%v", applied, err)
	}
	if runs != 1 {
		t.Fatalf("effect ran %d times, want 1", runs)
	}
}

func TestGuardRollsBackDedupOnEffectError(t *testing.T) {
	ctx := context.Background()
	pool := newTestSchema(t)
	idem := &Idempotent{Pool: pool, Schema: schema, Source: "s"}

	boom := errors.New("effect failed")
	if _, err := idem.Guard(ctx, 7, func(pgx.Tx) error { return boom }); !errors.Is(err, boom) {
		t.Fatalf("want effect error, got %v", err)
	}
	// the dedup marker must have rolled back with the effect, so a retry applies
	applied, err := idem.Guard(ctx, 7, func(pgx.Tx) error { return nil })
	if err != nil || !applied {
		t.Fatalf("retry after failed effect: applied=%v err=%v", applied, err)
	}
}
