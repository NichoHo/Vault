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
    funded_at    timestamptz,
    shipped_at   timestamptz,
    completed_at timestamptz
);

CREATE INDEX orders_buyer_idx ON orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller_idx ON orders (seller_id, created_at DESC);

CREATE TABLE reservations (
    order_id   uuid PRIMARY KEY REFERENCES orders(id),
    listing_id uuid NOT NULL REFERENCES listings(id),
    expires_at timestamptz NOT NULL
);

-- ponytail: outbox is written transactionally now; relay + Redpanda arrive in
-- Phase 3 when assist becomes the first consumer.
CREATE TABLE outbox (
    id           bigserial PRIMARY KEY,
    at           timestamptz NOT NULL DEFAULT now(),
    topic        text NOT NULL,
    payload      jsonb NOT NULL,
    published_at timestamptz
);
