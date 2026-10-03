import { pool } from "@workspace/db";
import { logger } from "./logger";
import { credencialesTelegram } from "./telegram-cred";
import { cuentaInstagram, graphInstagram, idInstagram, resolverEstadoContenedor, siguientePaso } from "./instagram-core";
import { generarCaptionInstagram, generarPlacaInstagram, type NotaIG } from "./instagram-editorial";
import { directAllowed } from "./runtime-policy";

interface Job {
  noticia_id: number; titulo: string; contenido: string; imagen_portada: string | null; estado: string; caption: string | null; imagen_url: string | null;
  cuenta_id: string | null; container_id: string | null; media_id: string | null;
  intentos: number; publicada: boolean; categoria_actual: string;
  telegram_estado: string;
}

async function validarInstagramDB(): Promise<void> {
  // Read-only catalog validation. Never migrate, repair or backfill at startup.
  const { rows } = await pool.query<{ tabla: boolean; noticia: boolean; columnas: string[]; trigger_def: string | null; funcion_def: string | null }>(`
    SELECT to_regclass('instagram_publicaciones') IS NOT NULL AS tabla,
      to_regclass('noticias') IS NOT NULL AS noticia,
      ARRAY(SELECT attname::text FROM pg_attribute
        WHERE attrelid = to_regclass('instagram_publicaciones') AND attnum > 0 AND NOT attisdropped) AS columnas,
      (SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t
        WHERE t.tgrelid = to_regclass('noticias')
          AND t.tgname = 'noticia_instagram_publicada'
          AND NOT t.tgisinternal AND t.tgenabled IN ('O', 'A')
          AND (t.tgtype & 23) = 21 LIMIT 1) AS trigger_def,
      (SELECT pg_get_functiondef(p.oid) FROM pg_proc p
        WHERE p.oid = to_regprocedure('enqueue_instagram_publicacion()') LIMIT 1) AS funcion_def
  `);
  const row = rows[0];
  const required = ["noticia_id", "categoria", "estado", "caption", "imagen_url", "cuenta_id",
    "container_id", "media_id", "error", "intentos", "created_at", "updated_at",
    "next_attempt_at", "telegram_estado", "telegram_message_id"];
  const trigger = row?.trigger_def ?? "";
  const fn = row?.funcion_def ?? "";
  if (!row?.tabla || !row.noticia || !required.every(col => row.columnas.includes(col))
    || !/INSERT OR UPDATE OF publicada/i.test(trigger)
    || !/enqueue_instagram_publicacion/i.test(trigger)
    || !/NEW\.categoria\s*=\s*'river'/i.test(fn)
    || !/NEW\.publicada/i.test(fn)
    || !/ON CONFLICT\s*\(noticia_id\)\s*DO NOTHING/i.test(fn)) {
    throw new Error("Instagram: esquema o trigger faltante/incompatible; migración manual requerida");
  }
  const { rows: newsColumns } = await pool.query<{ present: boolean }>(`
    SELECT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid = to_regclass('noticias') AND attname = 'imagen_instagram'
        AND attnum > 0 AND NOT attisdropped) AS present
  `);
  if (!newsColumns[0]?.present) throw new Error("Instagram: noticias.imagen_instagram faltante; migración manual requerida");
}
// User-authorized destination: only @riverplateisrael and River articles.
export async function procesarInstagram(): Promise<void> {
  if (!directAllowed()) return;
  const cuenta = cuentaInstagram("river");
  if (!cuenta) return;
  await validarInstagramDB();
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query("SELECT pg_try_advisory_lock(73191626) AS locked")).rows[0].locked;
    if (!locked) return;
    const result = await client.query<Job>(`SELECT j.*, n.titulo, n.contenido, n.imagen_portada, n.publicada, n.categoria AS categoria_actual
      FROM instagram_publicaciones j JOIN noticias n ON n.id = j.noticia_id
      WHERE j.categoria = 'river' AND j.created_at >= $1 AND j.next_attempt_at <= now()
        AND j.estado IN ('pendiente', 'preparada', 'publicando')
      ORDER BY j.next_attempt_at LIMIT 1`, [cuenta.desde]);
    const job = result.rows[0];
    if (!job) return;
    const save = async (changes: Record<string, unknown>) => {
      const entries = Object.entries(changes);
      await client.query(`UPDATE instagram_publicaciones SET ${entries.map(([key], i) => `${key} = $${i + 2}`).join(", ")}, updated_at = now() WHERE noticia_id = $1`, [job.noticia_id, ...entries.map(([, value]) => value)]);
      Object.assign(job, changes);
    };
    try {
      const identity = await graphInstagram(cuenta, cuenta.id, "GET", { fields: "id,username" });
      if (identity.username !== "riverplateisrael" || (job.cuenta_id && job.cuenta_id !== cuenta.id)) {
        await save({ estado: "revision", error: "La cuenta no corresponde a @riverplateisrael o cambió el destino" }); return;
      }
      if ((!job.publicada || job.categoria_actual !== "river") && job.estado !== "publicando") {
        await save({ estado: "cancelada", error: "La nota fue retirada o no pertenece a River" }); return;
      }
      if (siguientePaso(job) === "crear") {
        const nota: NotaIG = { id: job.noticia_id, titulo: job.titulo, contenido: job.contenido, imagenPortada: job.imagen_portada };
        if (!job.caption) await save({ caption: await generarCaptionInstagram(nota) });
        if (!job.imagen_url) await save({ imagen_url: await generarPlacaInstagram(nota) });
        // One stored asset serves web, Telegram and Instagram.
        const current = await client.query("UPDATE noticias SET imagen_instagram = $2 WHERE id = $1 AND publicada = true AND categoria = 'river' RETURNING id", [job.noticia_id, job.imagen_url]);
        if (!current.rows.length) { await save({ estado: "cancelada" }); return; }
        const telegram = process.env.EDITORIAL_TELEGRAM_ENABLED === "true" ? credencialesTelegram("river") : null;
        if (telegram && job.telegram_estado === "pendiente") {
          // Telegram has no idempotency key. Persist intent; never blindly retry an uncertain send.
          await save({ telegram_estado: "enviando" });
          try {
            const base = new URL(process.env.INSTAGRAM_PUBLIC_BASE_URL!);
            const response = await fetch(new URL(`https://api.telegram.org/bot${telegram.token}/sendPhoto`), {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: telegram.chatId, photo: job.imagen_url,
                caption: [...job.titulo].slice(0, 250).join("") + "\n\nLeé la nota: " + new URL(`/noticia/${job.noticia_id}`, base.origin).href }),
              signal: AbortSignal.timeout(30_000), redirect: "error",
            });
            const result = await response.json() as { ok?: boolean; result?: { message_id?: number } };
            if (!response.ok || !result.ok || !Number.isSafeInteger(result.result?.message_id)) throw new Error("Telegram no confirmó la entrega");
            await save({ telegram_estado: "enviada", telegram_message_id: String(result.result!.message_id) });
          } catch {
            await save({ telegram_estado: "revision" });
            logger.warn({ noticiaId: job.noticia_id }, "Creativo Telegram: revisar entrega, sin reenvío automático");
          }
        } else if (job.telegram_estado === "enviando") {
          await save({ telegram_estado: "revision" });
        }
        const container = idInstagram(await graphInstagram(cuenta, `${cuenta.id}/media`, "POST", { image_url: job.imagen_url!, caption: job.caption! }));
        await save({ container_id: container, cuenta_id: cuenta.id, estado: "preparada", error: null, intentos: 0 });
      }
      const container = await graphInstagram(cuenta, job.container_id!, "GET", { fields: "status_code" });
      const action = resolverEstadoContenedor(container.status_code, job.estado);
      if (action === "publicada") {
        await save({ estado: "publicada", error: null });
      } else if (action === "revision") {
        await save({ estado: "revision", error: "Revisar el contenedor en Meta antes de volver a publicar" });
      } else if (action === "esperar") {
        const attempts = job.intentos + 1;
        await save({ estado: attempts >= 60 ? "revision" : job.estado, intentos: attempts, next_attempt_at: new Date(Date.now() + 60_000), error: attempts >= 60 ? "Meta sigue procesando el contenedor; revisar" : null });
      } else {
        const current = await client.query("SELECT publicada, categoria FROM noticias WHERE id = $1", [job.noticia_id]);
        if (!current.rows[0]?.publicada || current.rows[0]?.categoria !== "river") { await save({ estado: "cancelada" }); return; }
        // Persist intent before irreversible call. Restart reconciles this container.
        await save({ estado: "publicando", error: null });
        const media = idInstagram(await graphInstagram(cuenta, `${cuenta.id}/media_publish`, "POST", { creation_id: job.container_id! }));
        await save({ estado: "publicada", media_id: media, error: null });
      }
    } catch {
      const attempts = job.intentos + 1, uncertain = job.estado === "publicando";
      await save({ estado: attempts >= 5 ? (uncertain ? "revision" : "fallida") : job.estado, intentos: attempts,
        error: uncertain ? "Respuesta de publicación incierta; consultar contenedor, sin reenviar" : "Falló la preparación o consulta; revisar configuración y servicio",
        next_attempt_at: new Date(Date.now() + Math.min(3600, 60 * 2 ** attempts) * 1000) });
      logger.warn({ noticiaId: job.noticia_id }, "Instagram: entrega pendiente de recuperación");
    }
  } finally {
    if (locked) {
      try { await client.query("SELECT pg_advisory_unlock(73191626)"); }
      catch { client.release(true); return; }
    }
    client.release();
  }
}
export async function iniciarInstagram(): Promise<void> {
  if (!directAllowed()) return;
  if (process.env.INSTAGRAM_ENABLED !== "true") return;
  const cuenta = cuentaInstagram("river");
  if (!cuenta) { logger.error("Instagram: falta configuración de River; worker desactivado"); return; }
  try {
    await validarInstagramDB();
  } catch {
    logger.error("Instagram: falta esquema/trigger de migración manual; worker desactivado");
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await procesarInstagram(); }
    catch { logger.error("Instagram: comprobar migración y base de datos"); }
    finally { running = false; }
  };
  void tick();
  setInterval(() => void tick(), 30_000).unref();
}
