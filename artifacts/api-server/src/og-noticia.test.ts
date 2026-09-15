import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { construirHtmlNoticia, generarImagenFallback, procesarImagenSocial } from "./og-noticia";

test("renderiza head dinámico por artículo con URLs absolutas", () => {
  const shell = `<!doctype html><html><head>
    <title>Sitio</title>
    <meta property="og:title" content="Sitio" />
    <meta property="og:image" content="https://riverplateisrael.com/opengraph.jpg" />
  </head><body><div id="root"></div></body></html>`;

  const html = construirHtmlNoticia(shell, {
    id: 42,
    titulo: "River & la noche grande",
    contenido: "Una noticia con suficiente contenido editorial para ser la descripción que reciben las redes sociales.",
    imagenPortada: "/objects/portadas/original.jpg",
    publicada: true,
  });

  assert.match(html, /<title>River &amp; la noche grande · River en Israel<\/title>/);
  assert.match(html, /property="og:title" content="River &amp; la noche grande"/);
  assert.match(html, /property="og:description" content="Una noticia con suficiente contenido editorial/);
  assert.match(html, /property="og:image" content="https:\/\/riverplateisrael\.com\/api\/og-image\/noticia\/42"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /property="og:image:type" content="image\/jpeg"/);
  assert.match(html, /property="og:url" content="https:\/\/riverplateisrael\.com\/noticia\/42"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/riverplateisrael\.com\/noticia\/42"/);
});

test("la imagen social generada y la portada redimensionada miden 1200x630", async () => {
  const fallback = await generarImagenFallback("Una nota sin imagen de portada");
  const portada = await sharp(Buffer.from(
    '<svg width="640" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="400" fill="#cc0000"/></svg>',
  )).png().toBuffer();

  for (const image of [fallback, await procesarImagenSocial(portada, "Portada de prueba")]) {
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 630);
    assert.equal(metadata.format, "jpeg");
  }
});