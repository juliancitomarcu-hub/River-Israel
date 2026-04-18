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

### Prompt IA Redactor
- Módulo compartido: `artifacts/api-server/src/lib/prompt-maestro.ts`
- Usado tanto por `scheduler.ts` como por `routes/redactor.ts`
- 6 secciones obligatorias: EL IMPACTO, ANÁLISIS TÁCTICO, LA MÍSTICA, CITAS Y CONTEXTO, PREGUNTAS, LA SENTENCIA
- DT actual: Eduardo Coudet. Gallardo solo como referencia histórica.

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
