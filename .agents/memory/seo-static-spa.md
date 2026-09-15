---
name: SEO en River (SPA estático + api-server)
description: Cómo se sirven sitemap/robots/meta dado que el frontend es estático y la API es un deploy aparte.
---

# SEO / Open Graph en River en Israel

El frontend (`artifacts/river-en-israel`) se publica como **SPA estático**
(`serve = "static"` en su artifact.toml). El `api-server` es un deploy VM separado
que sólo atiende `/api`. Bajo el mismo dominio, el proxy enruta por path
(más específico primero).

## Reglas / decisiones

- **Archivos de root dinámicos (ej. `/sitemap.xml`) deben salir del api-server.**
  Un SPA estático no puede generarlos. Para servirlos: agregar el path exacto a
  `paths` del artifact.toml del api-server (vía `verifyAndReplaceArtifactToml`) y
  montar la ruta a nivel app en `app.ts` **fuera** del router `/api` (el proxy no
  reescribe el path, así que Express recibe `/sitemap.xml` tal cual).
- **`robots.txt` es estático** en `public/` del frontend (lo sirve el host estático).
- **OG por nota (implementado ago 2026):** `/noticia` está en los `paths` del
  api-server; un handler baja el shell del SPA desde SITE_URL (cache 10 min),
  inyecta og:title/description/image por nota y lo sirve. Los usuarios reales
  cargan el mismo SPA; los crawlers ven la tarjeta correcta. Las portadas de
  object storage (`/objects/...`) se publican vía `/api/storage/objects/...` —
  cualquier URL pública de imagen debe usar ese prefijo.
- Promoción automática: toda publicación (scheduler, redactor, botón del bot)
  postea al canal público de Telegram si `TELEGRAM_CANAL_ID` está seteada
  (el bot debe ser admin del canal). WhatsApp no tiene API para canales.
- **Google Analytics** se inyecta en build vía plugin `transformIndexHtml` en
  `vite.config.ts`, gated por `process.env.GOOGLE_ANALYTICS_ID`. Sin la env var no
  inyecta nada. El usuario setea esa env var y redeploya.

**Why:** evita asumir que el frontend estático puede hacer trabajo dinámico, y deja
claro por qué el OG por nota no llega a WhatsApp con el approach actual.

El shell usado para las notas debe provenir del mismo entorno que sirve sus recursos.

**Why:** reutilizar el HTML de producción en desarrollo deja referencias a archivos compilados que no existen en el preview y produce una página en blanco.

**How to apply:** al cambiar el renderizado de metadatos, comprobar tanto el HTML que ve el crawler como la carga del artículo en el navegador; no basta con verificar las etiquetas.
