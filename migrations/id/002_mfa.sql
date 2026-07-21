CREATE TABLE totp_secrets (
    user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret     text NOT NULL,
    confirmed  boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recovery_codes (
    user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash text NOT NULL,
    used_at   timestamptz,
    PRIMARY KEY (user_id, code_hash)
);

CREATE TABLE refresh_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id  uuid NOT NULL,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id  text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    revoked_at timestamptz
);

CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

-- a session created by password login but awaiting the TOTP step
ALTER TABLE sessions ADD COLUMN pending_mfa boolean NOT NULL DEFAULT false;
