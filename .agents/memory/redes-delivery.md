---
name: Entrega de publicaciones a Make
description: Límites de confirmación y reintentos al enviar contenido a redes.
---

Un HTTP exitoso del webhook confirma la aceptación por Make, no la publicación final en Instagram u otra red.

**Why:** El escenario externo puede aceptar el JSON y fallar después en otro módulo. No prometer una publicación final basándose únicamente en la respuesta del webhook.

**How to apply:** Informar por separado recepción y publicación. No reintentar automáticamente un POST cuyo resultado fue ambiguo hasta disponer de deduplicación acordada con Make: un timeout puede ocurrir después de que el escenario haya iniciado una publicación.