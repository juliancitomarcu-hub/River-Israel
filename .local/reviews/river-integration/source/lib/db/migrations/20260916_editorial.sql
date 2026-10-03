-- Apply after 20260916_instagram.sql. Additive, no publication/backfill.
ALTER TABLE instagram_publicaciones ADD COLUMN IF NOT EXISTS telegram_estado text NOT NULL DEFAULT 'pendiente';
ALTER TABLE instagram_publicaciones ADD COLUMN IF NOT EXISTS telegram_message_id text;
