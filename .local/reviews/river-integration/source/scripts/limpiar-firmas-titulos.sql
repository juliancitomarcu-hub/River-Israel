-- Limpieza puntual de datos, no modifica el esquema.
-- Misma expresión que parsearResultado en artifacts/api-server/src/scheduler.ts.
-- Ejecutar en la base deseada; sólo actualiza títulos con un sufijo reconocido.
-- Es idempotente: volver a ejecutarlo no cambia títulos ya limpios.
BEGIN;

WITH regla AS (
  SELECT '\s+[-–—|]\s+(Olé|Ole|TyC Sports|Clarín|Clarin|La Nación|La Nacion|Infobae|ESPN|DeporTV|LA17|Doble Amarilla|cariverplate\.com\.ar|riverplate\.com)\s*$'::text AS patron
), afectados AS (
  SELECT id, titulo AS anterior,
         btrim(regexp_replace(titulo, patron, '', 'i')) AS nuevo
  FROM noticias CROSS JOIN regla
  WHERE titulo ~* patron
)
UPDATE noticias AS n
SET titulo = a.nuevo
FROM afectados AS a
WHERE n.id = a.id AND n.titulo = a.anterior
RETURNING n.id, a.anterior, n.titulo AS nuevo;

COMMIT;