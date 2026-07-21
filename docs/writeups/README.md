# Engineering write-ups

Three posts on the parts of [Vault](../../README.md) that were worth building
from scratch. Each is concrete, with code pulled from the repo.

1. **[Building an OIDC provider from the RFCs (and what I got wrong first)](01-oidc-from-the-rfcs.md)**
   — PKCE, single-use auth codes, RS256/JWKS, refresh rotation with reuse
   detection, TOTP; and the two things I got wrong on the first pass.

2. **[The transactional outbox pattern in practice](02-transactional-outbox-in-practice.md)**
   — the dual-write problem, the relay, at-least-once + idempotent =
   exactly-once effects, and the chaos test. Doubles as documentation for
   [outboxkit](https://github.com/NichoHo/outboxkit).

3. **[What my tests prove: invariant testing for money code](03-what-my-tests-prove.md)**
   — double-entry conservation, concurrent double-spends, escrow zeroing out,
   and timer-vs-manual exactly-once release.
