# Contributing to outboxkit

Thanks for your interest! outboxkit is deliberately small and single-purpose —
the transactional-outbox relay and idempotent consumer for PostgreSQL. Changes
that keep it focused and dependency-light are the easiest to merge.

## Development

Prereqs: Go 1.26+, a PostgreSQL you can point at (the tests create and drop a
throwaway `obk_test` schema).

```sh
git clone https://github.com/NichoHo/outboxkit
cd outboxkit
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/db go test -race ./...
```

The core package (`outboxkit`) must stay free of any message-broker dependency —
it talks only to the `Publisher` interface. Broker-specific code goes in a
subpackage (see `kafkapub`).

## Pull request checklist

- [ ] `gofmt -l .` is clean and `go vet ./...` passes.
- [ ] New behavior has a test; DB-backed tests skip cleanly when
      `TEST_DATABASE_URL` is unset.
- [ ] Exported symbols have a doc comment.
- [ ] The core package gains no new non-test third-party imports.
- [ ] The commit message explains the *why*, not just the *what*.

## Reporting bugs

Open an issue with a minimal reproduction and your Postgres version. The
delivery contract is **at-least-once**; if you think you've found a *lost* or a
*non-idempotent* event, please include the outbox/consumed_events state.

## Good first issues

See [docs/good-first-issues.md](docs/good-first-issues.md) for scoped starter
tasks.
