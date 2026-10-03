# Verificación adicional de Instagram (sin ejecución externa)

Esta comprobación complementa `ISOLATED_REVIEW.md`; no repite sus pruebas offline (11/11), imagen simulada (1/1) ni análisis esbuild ya válidos. No se instaló nada, no se inició servidor, no se conectó a PostgreSQL/Meta/Make y no se aplicó SQL.

## Typecheck API

Se intentó `tsc -p artifacts/api-server/tsconfig.json --noEmit --pretty false` con el TypeScript ya instalado en el workspace (5.9.3). En la fuente aislada terminó con código 2, **TS2688**: faltan los tipos `node` porque el clon no tiene dependencias instaladas (solo enlaces locales a `esbuild` y `sharp` para la prueba de imagen). El mismo comando en la base activa `9bc3bc4` terminó con código 2 y tres diagnósticos: dos **TS2769** y un **TS2339** en `edit-tokens.ts` relativos a `userAgent` de `panel_sessions`. La base tampoco pasa el typecheck.

Se hizo además un intento parcial en el clon apuntando `--typeRoots` a los `@types` existentes del API/workspace activo, **sin instalar ni modificar el workspace**. Terminó con código 2 y 182 líneas de diagnósticos (69 TS2307, 77 TS2339 y 36 TS7006), principalmente por módulos de runtime/workspace no resolubles desde el clon; las referencias a `instagram-editorial.ts`, `instagram-worker.ts` y rutas Instagram están contaminadas por esas ausencias. Esto **no** equivale a un typecheck completo ni demuestra ausencia/presencia de regresiones de tipos. No es correcto comparar esos 182 diagnósticos directamente con los tres de la base, porque las condiciones de resolución de dependencias difieren. La copia `restore-check` es otra reconstrucción de la integración, **no** la base de comparación.

## Pruebas con PGlite

`artifacts/api-server/tests/instagram-db.test.mjs` y `instagram-worker.test.mjs` importan `@electric-sql/pglite`. No existe el paquete en `node_modules/.pnpm`, ni en dependencias del API, ni en el clon. **No se ejecutaron** los dos tests: la ausencia de PGlite es un bloqueo de dependencias, no un resultado fallido de SQL o del worker. Conforme al límite de esta revisión, no se instaló PGlite ni se sustituyó por una base externa.

## Límites pendientes

Para cerrar validación técnica en un entorno aislado que tenga las dependencias disponibles: ejecutar typecheck con la misma resolución completa en base e integración y comparar diagnósticos; ejecutar ambas pruebas PGlite sin salida a red; revisar/aplicar migraciones manualmente en una base de pruebas separada. Nada aquí acredita publicación real, concurrencia entre réplicas, acceso a servicios externos o despliegue en producción.