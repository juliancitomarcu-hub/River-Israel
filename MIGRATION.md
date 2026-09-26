# Migración de River en Israel fuera de Replit

Este repositorio contiene un frontend Vite/React, una API Express, PostgreSQL,
archivos en Replit App Storage, dos bots de Telegram, un publicador periódico y
una integración con Make. GitHub guarda el código: **no** contiene las filas de
la base de datos, los objetos subidos ni los secretos de Replit.

## Despliegue de prueba

El `Dockerfile` compila ambos componentes y los sirve desde el mismo proceso.
En Render, crear un Web Service desde este repositorio, con runtime Docker,
health check `/api`, una instancia que permanezca activa y las variables
indicadas abajo. Usar al principio el dominio temporal del proveedor. La
configuración del contenedor fija `AUTOMATION_ENABLED=false`, para que una
prueba no registre los webhooks de Telegram ni publique noticias por su cuenta.

Variables necesarias para las funciones del sitio:

| Variable | Valor / procedencia |
| --- | --- |
| `DATABASE_URL` | Conexión de la **nueva** base PostgreSQL; secreto del proveedor. |
| `GOOGLE_CREDENTIALS_JSON` | JSON de cuenta de servicio con acceso al **nuevo** bucket GCS; guardarlo como secreto, jamás en Git. |
| `GEMINI_API_KEY` | Clave directa de la API de Gemini para redacción y traducción, fuera del proxy de Replit. |
| `PRIVATE_OBJECT_DIR` | `/<bucket>/<prefijo>` en el nuevo bucket; el prefijo debe coincidir con la copia de objetos. |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Rutas `/<bucket>/<prefijo>` separadas por comas, si se utilizan archivos públicos. |
| `SITE_URL` | URL pública del entorno (al final `https://riverplateisrael.com`). |
| `TELEGRAM_WEBHOOK_DOMAIN` | Dominio sin esquema; configurar únicamente al pasar a producción. |
| `AUTOMATION_ENABLED` | `false` en prueba; `true` solo después de verificar la migración y completar el cambio de dominio. |
| `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID` | Bot y chat existentes de River; conservar los mismos valores mediante secretos del proveedor. |
| `TELEGRAM_CANAL_ID` | Canal público de la filial (`@RiverPlateIsrael`); lo utiliza el bot de River para publicar la nota también en el canal. El bot debe conservar su permiso de administrador allí. |
| `TELEGRAM_TOKEN_SELECCION` y `TELEGRAM_CHAT_SELECCION` | Bot y chat existentes de La Scaloneta; conservar los mismos valores. |
| `OPENAI_API_KEY` | Generación automática de noticias del publicador. |
| `WEBHOOK_REDES_URL` y `MAKE_API_KEY` | Integración existente con Make, si está configurada. |

Revisar además los secretos usados por los módulos (`rg 'process.env' artifacts/api-server/src lib`):
otras claves de IA y credenciales de administración. Cargarlos en el panel de secretos del proveedor,
sin pegarlos en chats ni añadirlos al repositorio.

Para subir archivos directamente desde el navegador al nuevo bucket, configurar
su política CORS para los orígenes de prueba y de producción, permitiendo `PUT`
y las cabeceras `Content-Type`. Verificar una subida y lectura en `/api/storage`.

## Datos y archivos

1. Crear PostgreSQL y un bucket GCS propios. No usar la base gratuita de Render
   para producción permanente: según su documentación vence a los 30 días.
2. Desde un entorno autorizado con `DATABASE_URL` de Replit, generar una copia
   consistente con `pg_dump --format=custom --no-owner --no-acl --file=river.dump "$DATABASE_URL"`.
   Mantener el archivo fuera de Git y comprobar que no esté vacío.
3. Importar en la nueva base con `pg_restore --no-owner --no-acl --dbname="$NEW_DATABASE_URL" river.dump`.
   Revisar tablas y conteos de `noticias`, `galeria`, `videos`, `app_estado` y
   las demás tablas del esquema antes de habilitar escrituras.
4. Exportar **todos** los objetos de App Storage de Replit y copiarlos al nuevo
   bucket conservando la ruta relativa bajo `PRIVATE_OBJECT_DIR` y cada ruta de
   `PUBLIC_OBJECT_SEARCH_PATHS`. Las URLs `/objects/...` guardadas en la base
   dependen de esa ruta. Replit permite descargar objetos desde App Storage;
   para muchos archivos conviene automatizar el listado y copia desde su SDK
   dentro del proyecto antes de apagarlo.
5. Probar home, noticias, nota individual y vista previa social, galería,
   imágenes antiguas y nuevas, formularios y panel privado en el dominio temporal.

## Cambio de dominio

Mantener Replit en funcionamiento durante la prueba. Para el corte final,
detener temporalmente las escrituras y el publicador antiguos, realizar una
última copia incremental de base y objetos, verificar conteos, conectar el
dominio al nuevo servicio y probar `/api`, `/noticia/:id` y archivos.
Configurar `TELEGRAM_WEBHOOK_DOMAIN` con el dominio definitivo y habilitar
`AUTOMATION_ENABLED=true` **solo en la nueva instancia**. Confirmar que los dos
webhooks apuntan allí y que Make recibe una única publicación. Mantener una sola
instancia activa con el scheduler habilitado; las pruebas y las réplicas deben
conservar `AUTOMATION_ENABLED=false`. Comprobar los comandos y botones de ambos
bots, el envío manual, la publicación periódica y los avisos en los chats de
destino. Comprobar especialmente que cada nueva nota aparezca en el bot de
River y en el canal público de la filial una sola vez, con imagen y botón de
lectura enlazados al nuevo sitio. El estado del publicador (`app_estado`) viaja con PostgreSQL; copiarlo
antes de reactivar el scheduler para evitar noticias repetidas. Conservar el
respaldo y la antigua instancia hasta verificar que todo funciona.

## Limitaciones actuales

Este cambio de código no migra los datos ni los secretos automáticamente. El
bucket de Replit utiliza credenciales de su propio entorno: no se puede apuntar
una instancia externa a él mediante el sidecar de Replit. El traslado del
dominio requiere acceso a DNS y a la cuenta que administra el dominio.
