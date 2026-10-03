BEGIN;
CREATE TABLE IF NOT EXISTS instagram_publicaciones (
  noticia_id integer PRIMARY KEY REFERENCES noticias(id) ON DELETE CASCADE,
  categoria text NOT NULL, estado text NOT NULL DEFAULT 'pendiente',
  caption text, imagen_url text, cuenta_id text, container_id text, media_id text, error text,
  intentos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);
-- Atomic capture for panel, Telegram and scheduler. No historical backfill.
CREATE OR REPLACE FUNCTION enqueue_instagram_publicacion() RETURNS trigger AS $$
BEGIN
  IF NEW.categoria = 'river' AND NEW.publicada AND (TG_OP = 'INSERT' OR NOT OLD.publicada) THEN
    INSERT INTO instagram_publicaciones(noticia_id, categoria)
    VALUES (NEW.id, NEW.categoria) ON CONFLICT (noticia_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS noticia_instagram_publicada ON noticias;
CREATE TRIGGER noticia_instagram_publicada AFTER INSERT OR UPDATE OF publicada
ON noticias FOR EACH ROW EXECUTE FUNCTION enqueue_instagram_publicacion();
COMMIT;
