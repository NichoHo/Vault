CREATE TABLE categories (
    id   serial PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE
);

-- reserved/sold states + reservations arrive in Phase 2;
-- listing_images table arrives with uploads in Phase 3 — image_url carries the demo.
CREATE TABLE listings (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id   uuid NOT NULL,
    category_id int REFERENCES categories(id),
    title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    description text NOT NULL DEFAULT '',
    price_minor bigint NOT NULL CHECK (price_minor > 0),
    currency    text NOT NULL DEFAULT 'JPY',
    status      text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','withdrawn')),
    image_url   text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    search      tsvector GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || description)) STORED
);

CREATE INDEX listings_search_idx ON listings USING gin(search);
CREATE INDEX listings_feed_idx ON listings (created_at DESC, id DESC) WHERE status = 'active';
