# Good first issues

Scoped, self-contained tasks for a first contribution. Each should be a small PR
with a test.

## 1. Trace-context headers on published messages

`kafkapub.Publish` sets a `domain-topic` header. Add optional propagation of a
`traceparent` header (W3C Trace Context) read from the outbox row. Suggested
approach: add an optional `trace text` column convention and a
`kafkapub.WithTraceHeader()` option; when the column is present and non-empty,
attach it as a record header. Keep it opt-in so the base table schema is
unchanged.

**Touches:** `kafkapub/kafkapub.go`, a new test. **Difficulty:** small.

## 2. Retention sweeper for published rows

Published outbox rows accumulate forever. Add `outboxkit.Retention{Pool, Schema,
Keep time.Duration}` with a `SweepOnce(ctx) (int, error)` that deletes rows
where `published_at < now() - Keep`, plus a `Run(ctx)` ticker mirroring
`Relay.Run`. Include a test that seeds published + unpublished rows and asserts
only old published ones are deleted.

**Touches:** new `retention.go` + test. **Difficulty:** small.

## 3. Metrics hook on the relay

Add an optional `Relay.OnBatch func(published int, dur time.Duration)` callback
invoked after each successful drain, so users can wire Prometheus/OpenTelemetry
without outboxkit taking a metrics dependency. Add a test asserting the callback
fires with the right count.

**Touches:** `outboxkit.go` + test. **Difficulty:** small.
