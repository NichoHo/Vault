CREATE TABLE accounts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type text NOT NULL CHECK (owner_type IN ('user','escrow','platform','external')),
    owner_id   uuid,
    balance    bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- the double-spend backstop: Postgres itself refuses a negative balance
    CONSTRAINT balance_nonneg CHECK (owner_type = 'external' OR balance >= 0)
);

CREATE UNIQUE INDEX accounts_owner_idx
    ON accounts (owner_type, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'));

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
    amount_minor bigint NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entries_account_idx ON entries (account_id, id DESC);

-- ponytail: outbox is written transactionally now; relay + Redpanda arrive in
-- Phase 3 when assist becomes the first consumer.
CREATE TABLE outbox (
    id           bigserial PRIMARY KEY,
    at           timestamptz NOT NULL DEFAULT now(),
    topic        text NOT NULL,
    payload      jsonb NOT NULL,
    published_at timestamptz
);
