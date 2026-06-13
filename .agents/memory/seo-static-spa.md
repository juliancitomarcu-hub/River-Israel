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
- **Meta tags por nota = client-side a propósito.** El usuario eligió que con que
  Google los lea alcanza (no SSR). Helper: `src/lib/seo.ts`. Consecuencia: las
  previsualizaciones de WhatsApp/Facebook muestran la imagen **general** del sitio,
  no la de cada nota. Para previews por nota habría que enrutar `/noticia/*` por el
  servidor e inyectar OG en el shell (decisión pendiente, no implementada).
- **Google Analytics** se inyecta en build vía plugin `transformIndexHtml` en
  `vite.config.ts`, gated por `process.env.GOOGLE_ANALYTICS_ID`. Sin la env var no
  inyecta nada. El usuario setea esa env var y redeploya.

**Why:** evita asumir que el frontend estático puede hacer trabajo dinámico, y deja
claro por qué el OG por nota no llega a WhatsApp con el approach actual.
