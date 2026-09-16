# Publicación automática de River en Instagram

Al publicar una nota de categoría river, desde panel, Telegram o scheduler, se
encola un post para **@riverplateisrael**. Selección queda excluida.
La web no espera a Instagram. El worker procesa una entrega cada 30 segundos.
Se reutiliza Gemini, ya integrado, para el caption (gancho, párrafos breves,
pregunta, cierre y hasta 5 hashtags). No requiere migrar de Replit ni cambiar IA.
La placa editorial es JPEG 1080×1350: Gemini genera el collage y Sharp normaliza
el tamaño sin recortar textos. Usa el object storage existente de Replit.

## Activación

1. Aplicar `lib/db/migrations/20260916_instagram.sql` a la base elegida antes de
   activar el worker. Es aditiva, transaccional e idempotente, sin backfill histórico.
   Drizzle push por sí solo no crea el trigger; aplicar también este SQL.
   Luego aplicar `lib/db/migrations/20260916_editorial.sql` (estado de Telegram).
2. En una app de Meta configurar **Instagram API con Instagram Login**, autorizar
   la cuenta profesional @riverplateisrael con instagram_business_basic e
   instagram_business_content_publish. Gestionar revisión/acceso de Meta si la
   cuenta está fuera de los roles de la app. Esta integración no usa Facebook Login.
3. Guardar estas variables en Secrets de Replit, nunca en GitHub, .replit o frontend:

   - INSTAGRAM_RIVER_USER_ID: ID de la cuenta profesional.
   - INSTAGRAM_RIVER_ACCESS_TOKEN: token autorizado para esa cuenta.
   - INSTAGRAM_API_VERSION: versión vigente habilitada en Meta, formato vNN.0.
   - INSTAGRAM_RIVER_START_AT: instante UTC ISO (ej. 2026-09-16T20:00:00Z).
     Solo se procesan entregas encoladas desde ese instante. Conservarlo en reinicios.
   - INSTAGRAM_PUBLIC_BASE_URL=https://riverplateisrael.com
   - INSTAGRAM_ENABLED=true después de configurar todo.

4. Desplegar backend y frontend. Para procesamiento continuo usar una instancia
   siempre activa; un autoscale que duerme puede demorar la cola. El worker solo
   arranca en el contexto de producción existente, nunca al ejecutar las pruebas.
5. Verificar acceso HTTPS público a /api/storage/objects/instagram/...jpg.
   Publicar una nota de River posterior al instante de activación y comprobar
   Instagram y **Mis publicaciones → Instagram**.

La identidad devuelta por Meta debe ser exactamente riverplateisrael.
El token requiere renovación antes de su vencimiento; la renovación OAuth
automática no forma parte de este lote. Credenciales nunca se exponen en
respuestas ni logs de este módulo. No se publicaron posts durante desarrollo.

## Recuperación

- Una fila por noticia y lock PostgreSQL serializan réplicas.
- Editar una noticia no crea otro post. Retirarla antes del procesamiento cancela
  la entrega; después no borra el post de Instagram. Republicar una nota cancelada
  no reactiva el envío automáticamente.
- Se guardan texto, imagen, contenedor, cuenta y estado. Hay hasta 5 intentos
  con espera creciente para errores previos a publicar y reintento desde el panel.
- Antes de media_publish se persiste publicando. Ante timeout/reinicio se consulta
  el mismo contenedor. PUBLISHED confirma; una respuesta ambigua exige revisión
  manual en Meta y nunca provoca otro publish automático.
- Si se perdió el ID del post pero el contenedor está PUBLISHED, figura publicado
  sin media_id. Verificar en Instagram antes de intervenir; no resetear a ciegas.
- El alcance inicial es imagen individual + caption, no reels ni carruseles.
- Para detener: INSTAGRAM_ENABLED=false y reiniciar. Revertir código manteniendo
  tabla/trigger preserva historial. Los posts ya publicados no se revierten.

## Verificación

`node --test artifacts/api-server/tests/instagram*.test.mjs`

`pnpm run typecheck`

`pnpm --filter @workspace/api-server run build`

Endpoints protegidos por sesión admin:
GET /api/instagram/publicaciones y POST /api/instagram/publicaciones/:id/reintentar.

Documentación oficial: https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api

## Estética reutilizable y distribución

- Identidad versionada en `src/lib/editorial-style.ts`: rojo #D71920, marfil
  #F2EBDD, negro #151515 y acento lima #DFFF00; collage, figura recortada,
  diagonales, semitono y tipografía condensada. Referencia aprobada en
  `assets/editorial/referencia-river.png`, incluida automáticamente en el build.
- Modelo configurable con EDITORIAL_IMAGE_MODEL (default gemini-2.5-flash-image).
  Requiere GEMINI_API_KEY o la integración Gemini de Replit, modelo habilitado,
  cuota/crédito y storage público. Cada imagen consume uso de IA; la suscripción
  del chat no cubre la API. Si falla, queda pendiente/fallida: no reemplazamos
  silenciosamente el diseño por la tarjeta básica anterior.
- La referencia conserva una dirección visual, no garantiza composición,
  tipografía ni rostros idénticos. Revisar una prueba real con el proveedor antes
  de activar publicación automática. El ejemplo aprobado se creó con el generador
  de imágenes del chat; NO es prueba end-to-end de Gemini.
- Un solo JPEG se guarda en noticias.imagen_instagram y se muestra completo
  dentro de la nota web (la portada original se conserva), además de Instagram.
- EDITORIAL_TELEGRAM_ENABLED=true agrega envío de la misma imagen al bot principal
  mediante TELEGRAM_TOKEN/TELEGRAM_CHAT_ID, con título y enlace a la nota completa.
  Es adicional a los avisos/editorial previos del bot; no duplica el texto completo.
  No usa las credenciales de Selección. Dejarlo apagado si ese chat es sólo de moderación.
- Este lote reutiliza el worker de Instagram: la generación/distribución nueva
  requiere Instagram activado y su identidad validada; no es aún un distribuidor
  independiente de Meta. La web sigue publicando texto aunque Meta esté caído.
- Telegram guarda enviando antes de enviar. Un timeout/reinicio pasa a revision,
  nunca reenvía a ciegas. El estado se consulta en el endpoint admin (telegram_estado).
  Un fallo de Telegram no impide Instagram. No hay reintento automático de Telegram;
  comprobar primero el chat para evitar duplicados. Si faltan credenciales, se omite.
- No regenera creativos al editar una nota ni distribuye notas históricas.
  El ejemplo Gallardo–Ecuador en docs/examples es un borrador local, no publicado.
