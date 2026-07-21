// Package outboxkit implements the transactional-outbox pattern: a relay that
// drains an outbox table to a message sink at-least-once, and an idempotent
// consumer guard that turns at-least-once delivery into exactly-once effects.
//
// The dual-write problem it solves: a service that writes a row AND publishes an
// event in two separate steps can crash between them, losing the event or
// emitting one for a change that rolled back. Writing the event to an outbox
// table in the SAME database transaction as the state change makes the two
// atomic. A relay then publishes committed outbox rows out-of-band.
//
// Delivery is at-least-once (a crash after publishing but before marking the row
// re-publishes it). Consumers achieve exactly-once *effects* by wrapping their
// side effect in Idempotent.Guard, which records the event id in the same
// transaction as the effect.
//
// The core package has no message-broker dependency — it talks to a Publisher
// interface. See the kafkapub subpackage for a Redpanda/Kafka implementation.
package outboxkit

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Message is one outbox row to publish.
type Message struct {
	ID      int64
	Topic   string
	Payload []byte
}

// Publisher delivers a batch of messages to a sink. A non-nil error means the
// whole batch failed; the relay leaves those rows unpublished and retries them.
type Publisher interface {
	Publish(ctx context.Context, msgs []Message) error
}

// Relay drains <Schema>.outbox to a Publisher, marking rows published.
//
// The outbox table is expected to have at least:
//
//	id bigserial primary key, topic text, payload jsonb, published_at timestamptz
//
// At-least-once delivery: DrainOnce publishes inside a transaction and only
// marks rows published on COMMIT, so a crash after Publish succeeds but before
// COMMIT re-publishes those rows on the next drain.
type Relay struct {
	Pool   *pgxpool.Pool
	Schema string
	Pub    Publisher
	Batch  int           // rows per drain; default 100
	Poll   time.Duration // idle sleep between drains in Run; default 1s
	Logger *slog.Logger  // default slog.Default()
}

func (r *Relay) batch() int {
	if r.Batch > 0 {
		return r.Batch
	}
	return 100
}

func (r *Relay) poll() time.Duration {
	if r.Poll > 0 {
		return r.Poll
	}
	return time.Second
}

func (r *Relay) logger() *slog.Logger {
	if r.Logger != nil {
		return r.Logger
	}
	return slog.Default()
}

// DrainOnce publishes up to Batch unpublished rows and returns how many were
// published. It holds a transaction across the publish so a failure or crash
// leaves the rows unpublished (at-least-once). FOR UPDATE SKIP LOCKED lets
// multiple relays run concurrently without blocking each other.
func (r *Relay) DrainOnce(ctx context.Context) (int, error) {
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx,
		`SELECT id, topic, payload FROM `+r.Schema+`.outbox
		 WHERE published_at IS NULL ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`,
		r.batch())
	if err != nil {
		return 0, err
	}
	var msgs []Message
	var ids []int64
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.Topic, &m.Payload); err != nil {
			rows.Close()
			return 0, err
		}
		msgs = append(msgs, m)
		ids = append(ids, m.ID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if len(msgs) == 0 {
		return 0, nil
	}

	if err := r.Pub.Publish(ctx, msgs); err != nil {
		return 0, err // rows stay unpublished; retried next drain
	}
	if _, err := tx.Exec(ctx,
		`UPDATE `+r.Schema+`.outbox SET published_at = now() WHERE id = ANY($1)`, ids); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		// COMMIT failed after a successful publish → rows stay unpublished and
		// will be re-published. At-least-once holds; the consumer dedups.
		return 0, err
	}
	return len(msgs), nil
}

// Run drains in a loop until ctx is cancelled, sleeping Poll between empty
// drains and logging (not aborting) on transient errors.
func (r *Relay) Run(ctx context.Context) {
	for {
		if ctx.Err() != nil {
			return
		}
		n, err := r.DrainOnce(ctx)
		switch {
		case err != nil:
			r.logger().Error("outbox relay drain", "schema", r.Schema, "err", err)
			r.sleep(ctx, r.poll())
		case n == 0:
			r.sleep(ctx, r.poll())
		default:
			r.logger().Info("outbox relay published", "schema", r.Schema, "count", n)
			// loop immediately to drain a backlog fast
		}
	}
}

func (r *Relay) sleep(ctx context.Context, d time.Duration) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}

// Idempotent runs a consumer side effect at most once per (Source, eventID). The
// event id is recorded in <Schema>.consumed_events in the SAME transaction as
// the effect, so a redelivered event whose effect already committed is skipped.
//
// The consumed_events table is expected to be:
//
//	source text, event_id bigint, primary key (source, event_id)
type Idempotent struct {
	Pool   *pgxpool.Pool
	Schema string
	Source string
}

// ErrNilEffect is returned when Guard is called without an effect function.
var ErrNilEffect = errors.New("outboxkit: nil effect")

// Guard runs effect exactly once for eventID. It returns applied=true when the
// effect ran (first delivery) and applied=false when the event was already
// consumed (redelivery). The effect and the dedup marker commit together.
func (i *Idempotent) Guard(ctx context.Context, eventID int64, effect func(pgx.Tx) error) (applied bool, err error) {
	if effect == nil {
		return false, ErrNilEffect
	}
	tx, err := i.Pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`INSERT INTO `+i.Schema+`.consumed_events (source, event_id) VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`, i.Source, eventID)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil // already consumed
	}
	if err := effect(tx); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}
