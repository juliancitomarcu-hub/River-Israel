# Inventario previo al cambio visible: portada → nota → siguiente lectura

Ámbito: `Home.tsx`, `Noticia.tsx` y controles compartidos efectivamente visibles (`Navbar`, `Footer`, `ShareButton`, `ProximoPartidoWidget`). Rutas españolas actuales: `/`, `/river`, `/noticia/:id`; `/redactor` es privado/editorial y no se modifica. La lista pública `GET /api/noticias-publicadas?categoria=river&page=0&limit=6` y el detalle público `GET /api/noticias-publicadas/:id` ya existen; `lang=he` en la lista filtra **solamente** traducciones publicadas. El detalle incluye `tituloHe`, `contenidoHe`, `tagsHe` y `hebreoPublicada`; un borrador no debe aparecer como traducción publicada.

| Superficie / control | Ruta o handler actual | Acción esperada; tratamiento del recorrido hebreo |
| --- | --- | --- |
| Barra: logo, Portada | `/` | Portada; en hebreo `/he`, sin tocar destino español. |
| Barra: Historia, Plantel, Fixture, Galería | `/historia`, `/equipo`, `/fixture`, `/galeria` | Navegación española preservada; desde hebreo, etiquetas españolas explícitas si se sale de la sección traducida. |
| Barra: Filial | `/#filial`, `handleNavClick` desplaza al ancla | Conservar ancla; no simular sección hebrea. |
| Barra: WhatsApp; móvil menú/links/canal | enlace externo; `setMobileMenuOpen`, navegación/ancla | Abrir canal real; menú abre/cierra, enlaces idénticos. |
| Portada: destacada, secundarias, lista compacta | `/noticia/:id` | Abrir detalle real; en hebreo `/he/noticia/:id`, únicamente traducciones publicadas. |
| Portada: compartir destacada | `ShareButton` menú portal; copiar URL / WhatsApp / Facebook / Instagram (copiar) / X / Telegram / cerrar | Mantener acciones reales y URL canónica española para versión española; en hebreo compartir enlace hebreo solo cuando existe traducción pública. Evitar burbujeo hacia la nota. |
| Portada: anterior, números, siguiente | `setPaginaActualidad` + scroll | Cambiar página consultada; texto accesible y dirección RTL en hebreo. |
| Portada: Fixture completo | `/fixture` | Ir al fixture actual, español sin fingir traducción. |
| Portada: canal WhatsApp, Telegram, Conocé la filial | respectivos enlaces externos | Abrir destinos reales, no enviar contenido. |
| Portada: Postulate como socio | `/postula` | Ir al formulario español real; no simular envío. |
| Portada: enlaces Historia/Plantel/Fixture/Galería, Instagram/Facebook | rutas y redes reales | Conservados; no rebautizar secciones no traducidas. |
| Widget próximo partido: cierre de ampliación, control de detalles | `onClose`, estado interno | Mantener comportamiento y datos actuales; interfaz española etiquetada como tal en hebreo. |
| Nota: volver (error, cabecera, pie) | `/` | Regresar a `/he` en ruta hebrea; español intacto. |
| Nota: Me gusta/Me encanta | `useReacciones` + `localStorage` por ID | Alternar reacción local, no afirmar conteo global. |
| Nota: compartir / flotante WhatsApp | `ShareButton` y `whatsapp://send` | Compartir ruta correcta; no enviar automáticamente. |
| Nota: frase y botón copiar | `navigator.clipboard.writeText` | Copiar frase; contenido español solo en ruta española. |
| Nota: nombre, opinión, Publicar comentario | POST `/api/noticias/:id/comentarios` | En español, mantener publicación; en vista hebrea de revisión no exponer envío sin garantías de idioma. |
| Nota: relacionadas (hasta tres) | `useNews(0,categoria)` + `/noticia/:id` | Sustituir selección cronológica por pertinencia comprobable; no repetir nota ni mismo hecho, y mostrar vacío/fallback explícito. |
| Nota: CTA canal WhatsApp | enlace externo real | Abrir canal. |
| Footer: navegación, redes, WhatsApp | rutas existentes y enlaces externos | Preservar todas las rutas existentes; no simular traducción. |
| Footer: triple clic oculto del escudo | `navigate("/redactor")` | Preservar acceso existente de admin; sin añadir ruta alternativa. |

Plan concreto: introducir `/he` y `/he/noticia/:id` públicos sin redirigir el castellano; consumir `lang=he` exclusivamente en lista hebrea. Estado vacío si no hay notas hebreas publicadas; detalle hebreo por URL directo comprueba `hebreoPublicada` y longitud de `contenidoHe` antes de renderizar. Borradores, si se usan en revisión aislada, llevan marca explícita y jamás se tratan como publicados. Recomendaciones: mismo corpus público en idioma elegido, coincidencias temáticas y veto a títulos casi duplicados; si faltan candidatos, explicar que no hay lectura afín.

## Vista interactiva aislada para revisión

Artefacto `artifacts/mockup-sandbox/src/components/mockups/river-hebrew-review/Review.tsx`; ruta `/__mockup/preview/river-hebrew-review/Review`. Importa **los mismos Home y Noticia editados del clon**, en vez de dibujar otra portada. Lee únicamente GET públicos de noticias reales; no usa traducciones inventadas: presenta el original español con una etiqueta permanente de **borrador de revisión, no traducción publicada**. En esta vista se ocultan el envío de comentarios, reacciones y compartir URLs de borrador; no hay mutaciones al backend. El widget deportivo solo hace GET. Los enlaces fuera del recorrido acotado conservan su destino español y no equivalen a un flujo de prueba aprobado.

Para probar en móvil: `[data-testid="link-featured-27"]` abre la nota 27; `[data-testid="link-next-reading-22"]` abre la nota 22 cuando la API pública conserve esa selección y el filtro de pertinencia la admita; `[data-testid="link-article-home"]` vuelve a la portada; `[data-testid="button-review-home"]` vuelve al inicio desde cualquier vista. El ID de la nota destacada puede cambiar al publicarse otras noticias: en ese caso usar `[data-testid^="link-featured-"]` y `[data-testid^="link-next-reading-"]`. `[data-testid="status-no-related"]` explica la ausencia de una siguiente lectura pertinente. En la app real, `[data-testid="link-language-switch"]` alterna rutas, `[data-testid="status-hebrew-empty"]` indica que no hay traducciones publicadas y `[data-testid="link-spanish-original"]` lleva del detalle hebreo no publicado al original.