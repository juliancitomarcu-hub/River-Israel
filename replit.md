# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

## River en Israel — Proyecto Principal

Fan website en español para Club Atlético River Plate / Filial Ramat Gan, Israel.

### Rutas frontend (`artifacts/river-en-israel`)
- `/` — Home (actualidad, fixtures, historia, postulación, galería)
- `/actualidad` — Noticias publicadas
- `/historia` — Historia del club (timeline editable)
- `/equipo` — Plantel
- `/filial-ramat-gan` — Info filial
- `/postula` — Formulario para escribir en el sitio (acepta texto + PDF/Word)
- `/redactor` — **PRIVADO** — acceso vía triple-click en logo del footer o link invisible "1901"

### Redactor IA (privado)
Tabs: Redactor IA | Mis publicaciones | Historia | Postulantes | Fotos de Galería

### Dominio de Producción
- **Sitio**: `https://riverplateisrael.com` (con 'e')
- **Replit domain**: `riverplateisrael.replit.app` (con 'e') → sirve HTML + API completa via Google Frontend
- **TELEGRAM_WEBHOOK_DOMAIN** (env var production): `riverplateisrael.com` — el webhook de Telegram y los links de edición apuntan a este dominio
- El otro dominio `riverplatisrael.replit.app` (sin 'e') solo sirve el frontend estático, no la API

### Timezone Israel (DST Manual)
- `artifacts/api-server/src/routes/partidos.ts` usa `israelOffsetHoras()` — cálculo manual de DST, sin dependencia de ICU
- IDT (verano israelí): último viernes de marzo → último domingo de octubre → UTC+3
- IST (invierno israelí): noviembre → marzo → UTC+2
- Promiedos devuelve `start_time` en UTC-4; se suma +4h para obtener UTC, luego offset Israel

### Sin asteriscos en las notas
- Las notas publicadas nunca contienen `*`: `lib/limpiar-asteriscos.ts` (`limpiarNota`) se aplica en todos los `parsearResultado` (scheduler, publicar, redactor), en publicación libre, en la edición vía Telegram y como guardarraíl SQL al publicar desde el botón del bot; el traductor hebreo también los elimina. El frontend además los quita al renderizar (cubre notas viejas de producción).

### Prompt IA Redactor
- Módulo compartido: `artifacts/api-server/src/lib/prompt-maestro.ts`
- Usado tanto por `scheduler.ts` como por `routes/redactor.ts`
- 6 secciones obligatorias: EL IMPACTO, ANÁLISIS TÁCTICO, LA MÍSTICA, CITAS Y CONTEXTO, PREGUNTAS, LA SENTENCIA
- DT actual: Eduardo Coudet. Gallardo solo como referencia histórica.

### Estado persistente en DB (`app_estado`)
- Tabla `app_estado` (clave PK, valor jsonb): guarda `scheduler_state` (rotación de fuentes, categoriaFlip, urlsProcesadas) y `redactor_settings`. Antes vivían en JSON locales que producción borraba en cada reinicio → la rotación siempre arrancaba en "bolavip" y no se publicaba nada.
- Helper: `artifacts/api-server/src/lib/app-estado.ts` (`leerEstadoApp`/`guardarEstadoApp`). Redactor settings usa cache en memoria hidratado con `initRedactorSettings()` al boot (antes de arrancar el scheduler).
- Healthcheck del deployment: `GET /api` responde 200 (handler raíz en `routes/index.ts`); sin él, el server se reiniciaba cada ~40 min.
- El ciclo del scheduler ahora recorre todas las fuentes (empezando por la del turno) hasta encontrar una noticia nueva; timeouts de scraping no matan el ciclo. Con `fuenteOverride` sigue siendo un solo intento.

### Autopublicación (scheduler)
- El ciclo periódico (cada 2h, solo en producción) corre en modo automático: publica la nota directamente (`publicada:true`) y el bot de Telegram envía solo un FYI con botón "Editar en Redactor".
- **La Scaloneta está oculta**: el ciclo periódico publica SOLO categoría "river" (web, Telegram, Instagram). "seleccion" queda solo para disparos manuales desde el panel/trigger. En el frontend, `/scaloneta` y `/mundial/*` redirigen a `/`.
- Foto de portada: la imagen scrapeada del artículo se descarga (validación SSRF + content-type) y se sube a object storage (`/objects/portadas/...`). **Sin foto real NO hay autopublicación**: la nota se guarda como pendiente y llega a Telegram con botones Publicar/Editar y aviso "sin foto". La foto de respaldo de galería solo aplica en flujo manual/pendiente.
- Prompt maestro incluye el plantel oficial completo (riverplate.com, julio 2026); arquero titular: Santiago Beltrán. González Pirez nunca debe mencionarse como arquero ni jugador actual.
- Promoción automática: cada nota publicada (autopublicación, Redactor o botón Publicar del bot) se postea al canal público de Telegram (`TELEGRAM_CANAL_ID`, el bot debe ser admin) con foto, extracto, fuente y botón "Leer en riverplateisrael.com"; si la nota es previa de partido se agrega tarjeta "⏰ Próximo partido" con datos de `/api/partido-proximo` (`src/lib/promocionar-nota.ts`).
- Open Graph dinámico por nota: `/noticia/:id` se enruta al api-server (paths del artifact.toml) y `src/og-noticia.ts` sirve el shell del SPA con og:title/og:image/og:description de la nota → vista previa correcta en WhatsApp/redes.
- `resolverPortada()` en `use-river-data.ts` resuelve los 3 formatos de portada: `/objects/` → `/api/storage`, `/images/` → BASE_URL, `http(s)` externas tal cual.

### Dedupe anti-repetidos (scheduler)
- URL canónica normalizada (`normalizarUrl`: sin hash/utm/fbclid/trailing slash, lowercase) guardada en `noticias.url_fuente` con índice único parcial (`url_fuente <> ''`); insert usa `onConflictDoNothing()`.
- Chequeos antes de elegir candidata: estado en memoria (`urlsProcesadas`, cap 1000) + `urlYaEnDB()` contra todo el historial + título heurístico (30 días, 2 palabras distintivas coincidentes por raíz, genéricas como "river"/"argentina" excluidas, compara contra título IA y título original scrapeado).

### Instagram vía Make.com
- `lib/enviar-a-make.ts` → `enviarNotaAMake(nota)`: POST fire-and-forget al webhook de Make (`MAKE_WEBHOOK_URL` env, header `x-make-apikey` desde `MAKE_API_KEY` — el webhook lo exige). Payload: id, titulo, contenido, caption listo para IG (título + primer párrafo + link + tags, cap ~1800), tags, categoria, fuente, urlNota, imagen absoluta (`/objects/` → `/api/storage`, `/images/` → dominio, http externa tal cual).
- Se dispara en todos los caminos de publicación: dentro de `notificarNotaPublicada` (redactor, edición que publica, publicación libre) + llamada directa en telegram-webhook callback `publicar_` y en la autopublicación del scheduler.
- Imagen para IG: `GET /api/instagram-imagen/:id` (routes/instagram-imagen.ts) sirve la portada procesada con sharp — recorte 4:5 (1080×1350, `position: attention`), JPEG q80, cache en memoria (50 entradas). Origen: `/objects/` vía object storage, `/images/` vía dominio propio (localhost:80 en dev), http externa con fetch (timeout 15s, valida content-type image/*). `enviarNotaAMake` manda esta URL como `imagen` cuando la nota tiene portada. `sharp` está en `external` del build esbuild.

### Avisos de Telegram al publicar
- `lib/notificar-publicacion.ts` → `notificarNotaPublicada(nota)`: aviso fire-and-forget con botón "Ver la nota" (`https://{TELEGRAM_WEBHOOK_DOMAIN}/noticia/{id}`), bot según categoría (river/selección), Markdown escapado.
- Todos los caminos de publicación avisan: redactor (publicar-noticia), edición que publica (noticia-pendiente, solo si pasa a publicada), publicación libre, botón Publicar del bot (edita mensaje o envía fallback) y autopublicación del scheduler (FYI propio con botones Ver/Editar).

### API (`artifacts/api-server`)
Rutas relevantes:
- `GET /api/galeria` — listar fotos (auto-seed 12 fotos si vacío)
- `POST /api/galeria` — subir nueva foto (multipart)
- `PUT /api/galeria/:id` — editar caption
- `DELETE /api/galeria/:id` — eliminar foto
- `GET /api/postulaciones` — listar postulaciones
- `POST /api/postular-redactor` — enviar postulación (texto + archivo)
- `POST /api/publicar/:id` — publicar postulación
- Rutas de scraping, redacción IA, Telegram webhook, etc.
- `GET/PUT /api/redactor-settings` — configuración del panel (hora resumen, TTL links de resumen en horas, TTL links de edición por nota en minutos `linkEdicionTtlMinutos` 5–1440, secciones del resumen)

### DB Schema
- `noticiasTable` — noticias + postulaciones (fuente.startsWith("Postulación"))
- `historiaHitosTable` — hitos históricos del club
- `galeriaTable` — fotos de la galería (url, caption, orden)

### Galería
- 12 fotos iniciales copiadas a `artifacts/river-en-israel/public/images/galeria/foto-01.jpeg` a `foto-12.jpeg`
- Nuevas fotos se suben a object storage; URL empieza en `/objects/`
- `resolverUrl()` en frontend convierte `/objects/...` → `/api/storage/objects/...`

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
