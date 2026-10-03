-- Additive, idempotent migration; existing sessions remain valid.
ALTER TABLE panel_sessions ADD COLUMN IF NOT EXISTS user_agent text;