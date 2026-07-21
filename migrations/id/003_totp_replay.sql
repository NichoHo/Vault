-- Single-use TOTP (RFC 6238 §5.2): a code whose 30s step was already accepted
-- must be rejected on replay. last_used_step is the highest step counter the
-- login TOTP step has consumed so far; the login handler only accepts a step
-- strictly greater than it.
ALTER TABLE totp_secrets ADD COLUMN last_used_step bigint NOT NULL DEFAULT 0;
