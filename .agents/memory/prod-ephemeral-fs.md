---
name: Producción borra archivos locales en cada reinicio
description: Nada de estado persistente en archivos JSON locales en el api-server; usar la tabla app_estado.
---

Regla: cualquier estado que deba sobrevivir reinicios (rotación del scheduler, settings del panel, contadores) va a la tabla `app_estado` (clave/jsonb) vía el helper de app-estado, nunca a archivos locales tipo `*.json` en el cwd.

**Why:** El deployment (autoscale) reinicia el server con frecuencia y el filesystem es efímero: en julio 2026 el scheduler nunca publicaba porque su estado en `scheduler_state.json` se reseteaba en cada reinicio (siempre la misma fuente + dedupe descartaba todo). Además, los healthchecks del deployment pegan a `GET /api` y `GET /sitemap.xml` — si devuelven ≠200, la plataforma reinicia el server en loop.

**How to apply:** Al agregar estado nuevo en api-server, persistirlo en `app_estado`. Al agregar rutas/reestructurar app.ts, mantener `GET /api` respondiendo 200.
