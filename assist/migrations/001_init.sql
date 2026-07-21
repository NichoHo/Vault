CREATE TABLE suggestions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL,
    listing_id     uuid,
    model          text NOT NULL,
    input_title    text NOT NULL DEFAULT '',
    input_image    text NOT NULL DEFAULT '',
    title          text NOT NULL DEFAULT '',
    description    text NOT NULL DEFAULT '',
    category_slug  text NOT NULL DEFAULT '',
    price_low      bigint,
    price_high     bigint,
    accepted_fields text[],
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE risk_scores (
    id           bigserial PRIMARY KEY,
    subject_type text NOT NULL,
    subject_id   text NOT NULL,
    score        double precision NOT NULL,
    reasons      jsonb NOT NULL DEFAULT '[]',
    status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','approved','rejected')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    resolved_by  text,
    resolved_at  timestamptz
);

CREATE TABLE consumed_events (
    source   text NOT NULL,
    event_id bigint NOT NULL,
    PRIMARY KEY (source, event_id)
);

-- synthetic sold-history for price bands.
-- ponytail: FTS word-overlap similarity; swap for pgvector embeddings when a
-- real embedding source exists.
CREATE TABLE comparables (
    id            bigserial PRIMARY KEY,
    title         text NOT NULL,
    category_slug text NOT NULL,
    price_minor   bigint NOT NULL,
    search        tsvector GENERATED ALWAYS AS (to_tsvector('simple', title)) STORED
);

CREATE INDEX comparables_search_idx ON comparables USING gin(search);
