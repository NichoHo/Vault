CREATE TABLE users (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email      text NOT NULL UNIQUE,
    handle     text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE credentials (
    user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash text NOT NULL,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    id         text PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE TABLE oauth_clients (
    id            text PRIMARY KEY,
    name          text NOT NULL,
    redirect_uris text[] NOT NULL
);

CREATE TABLE consents (
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id  text NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scope      text NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, client_id)
);

CREATE TABLE auth_codes (
    code           text PRIMARY KEY,
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id      text NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    redirect_uri   text NOT NULL,
    scope          text NOT NULL,
    nonce          text NOT NULL DEFAULT '',
    code_challenge text NOT NULL,
    expires_at     timestamptz NOT NULL,
    used_at        timestamptz
);

CREATE TABLE signing_keys (
    kid         text PRIMARY KEY,
    private_pem text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    active      boolean NOT NULL DEFAULT true
);

CREATE TABLE audit_events (
    id     bigserial PRIMARY KEY,
    at     timestamptz NOT NULL DEFAULT now(),
    actor  text NOT NULL DEFAULT '',
    action text NOT NULL,
    meta   jsonb NOT NULL DEFAULT '{}'
);
