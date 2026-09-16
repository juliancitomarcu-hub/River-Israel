import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../package.json', import.meta.url));
const { build } = require('esbuild'), sharp = require('sharp');
test('editorial card renders as JPEG 1080×1350 with escaped title', async () => {
  const input = await sharp({ create: { width: 108, height: 135, channels: 3, background: '#D71920' } }).png().toBuffer();
  let uploaded, request, fail = false;
  globalThis.__editorialImageTest = {
    ai: { models: { generateContent: async args => { request = args; return fail ? {} : { candidates: [{ content: { parts: [{ inlineData: { data: input.toString('base64'), mimeType: 'image/png' } }] } }] }; } } },
    storage: class { async uploadBuffer(path, data, mime) { uploaded = { path, data, mime }; return '/objects/' + path; } },
  };
  const originalBase = process.env.INSTAGRAM_PUBLIC_BASE_URL;
  process.env.INSTAGRAM_PUBLIC_BASE_URL = 'https://example.org';
  const bundle = await build({ define: { 'import.meta.url': JSON.stringify(new URL('../src/lib/instagram-editorial.ts', import.meta.url).href) }, entryPoints: [fileURLToPath(new URL('../src/lib/instagram-editorial.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'offline', setup(b) {
    b.onResolve({ filter: /^sharp$/ }, () => ({ path: pathToFileURL(require.resolve('sharp')).href, external: true }));
    b.onResolve({ filter: /^(@workspace\/integrations-gemini-ai|\.\/objectStorage)$/ }, args => ({ path: args.path, namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === './objectStorage' ? 'export const ObjectStorageService = globalThis.__editorialImageTest.storage;' : 'export const ai = globalThis.__editorialImageTest.ai;' }));
  } }] });
  const { placaInstagram, generarPlacaInstagram } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  try {
    const url = await generarPlacaInstagram({ id: 10, titulo: 'Gallardo a Ecuador', contenido: 'La noticia' });
    assert.match(url, /^https:\/\/example.org\/api\/storage\/objects\/instagram\/10-/);
    assert.equal(request.config.imageConfig.aspectRatio, '4:5');
    assert.ok(request.contents[0].parts[1].inlineData.data.length > 1000);
    assert.ok(request.contents[0].parts[0].text.includes('#D71920'));
    assert.equal(uploaded.mime, 'image/jpeg');
    const generated = await sharp(uploaded.data).metadata();
    assert.equal(generated.width, 1080); assert.equal(generated.height, 1350);
    fail = true; uploaded = undefined;
    await assert.rejects(generarPlacaInstagram({ id: 11, titulo: 'River', contenido: '' }), /no devolvió/);
    assert.equal(uploaded, undefined);
  } finally {
    delete globalThis.__editorialImageTest;
    if (originalBase === undefined) delete process.env.INSTAGRAM_PUBLIC_BASE_URL;
    else process.env.INSTAGRAM_PUBLIC_BASE_URL = originalBase;
  }
  const jpeg = await sharp(Buffer.from(placaInstagram({ id: 1, titulo: 'River prepara una nueva noche en el Monumental', contenido: '' }))).jpeg({ quality: 90 }).toBuffer();
  const meta = await sharp(jpeg).metadata();
  assert.equal(meta.width, 1080); assert.equal(meta.height, 1350); assert.equal(meta.format, 'jpeg'); assert.ok(jpeg.length < 8 * 1024 * 1024);
  const escaped = placaInstagram({ id: 2, titulo: '<script> & "River" ' + 'noticia '.repeat(100), contenido: '' });
  assert.ok(!escaped.includes('<script>')); assert.ok(escaped.includes('&lt;script&gt;'));
  await sharp(Buffer.from(escaped)).jpeg().toBuffer();
  if (process.env.IG_PREVIEW_FILE) await writeFile(process.env.IG_PREVIEW_FILE, jpeg);
});
