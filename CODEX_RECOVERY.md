# Recuperación River en Israel — revisión, no despliegue

Origen actual: 74ea7aceb05e36ac84fd5aadb5b17eabe039f4e3. No es un proyecto nuevo.

## Contenido
- Código actual en sus rutas originales.
- Trabajo aislado completo de código en .local/reviews/river-integration/source (incluido explícitamente aunque .gitignore lo excluya). No fusionado en la app activa.
- Prompt editorial activo: artifacts/api-server/src/lib/openai-news.ts, SYSTEM_PROMPT_RIVER y SYSTEM_PROMPT_SELECCION. Comparar con la misma ruta dentro de la revisión aislada; no sustituir automáticamente.
- Documentación de integración y hebreo dentro de la revisión aislada, carpeta docs.
- Assets públicos referenciados por el código y recursos public; no se incluyen conversaciones ni archivos adjuntos sin referencias.

## Seguridad y diferencias deliberadas
Los .replit de ambas copias tienen valores de configuración sensibles sustituidos por REDACTED_CONFIGURE_PRIVATELY. No se transfieren secretos administrados, dumps, paquetes cifrados, reportes con datos, capturas, metadatos internos, estados scheduler_state.json/partido-override.json ni historial local Git. No se publican los antiguos bundles/patches sin depurar; el código aislado actual queda conservado directamente. El padre de esta rama es main del repositorio existente, no el historial privado Replit.

## Instrucciones para Codex
Inspección de código solamente. No iniciar la aplicación, bots, schedulers ni scripts post-merge/install con credenciales productivas. No enviar mensajes ni ejecutar migraciones, SQL de reparación o despliegues. No tocar main. Instagram permanece desactivado en cualquier revisión futura. La parte hebrea no está certificada como terminada; no tratar borradores españoles como traducciones publicadas. Las pruebas históricas de la documentación NO fueron repetidas para esta transferencia.

## Respaldos privados (NO incluidos)
Código/objetos: a6a31cbe4b6b8269f81a9626e58a185d5d5fb297ae8ca99c5eee65c935bdab1e.
Base: cc48a97b557dfa5d6f5fda968bbdc01da12214b0389c41770f361d7b318f6ac3.
1.187 objetos del bucket configurado. Comprobación de producción: 2.344 noticias, 791 publicadas. Dump cifrado, autenticación y lectura integral pg_restore verificadas. Restauración SQL aislada PENDIENTE.
Paquetes preservados en el workspace de origen. GitHub contiene solo código/documentación pública; NO constituye entrega de estos paquetes a Codex. Hace falta un canal privado autorizado alcanzable por ambos entornos. No crear enlaces públicos ni servicios temporales. Rotación de credencial productiva pendiente de coordinación: no realizarla en esta tarea.

## Verificación
TRANSFER_MANIFEST.json enumera los blobs Git exactos de los archivos transferidos. Verificar contra el árbol del commit de esta rama. Un clon con checkout normal incluye los archivos aislados aunque estén gitignored; evitar git clean -fdx.
