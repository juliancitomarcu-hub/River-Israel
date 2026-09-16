import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../package.json', import.meta.url));
const { build } = require('esbuild'), sharp = require('sharp');
test('editorial card renders as JPEG 1080×1350 with escaped title', async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/instagram-editorial.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'offline', setup(b) {
    b.onResolve({ filter: /^sharp$/ }, () => ({ path: pathToFileURL(require.resolve('sharp')).href, external: true }));
    b.onResolve({ filter: /^(@workspace\/integrations-gemini-ai|\.\/objectStorage)$/ }, args => ({ path: args.path, namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === './objectStorage' ? 'export class ObjectStorageService {}' : 'export const ai = {};' }));
  } }] });
  const { placaInstagram } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const jpeg = await sharp(Buffer.from(placaInstagram({ id: 1, titulo: 'River prepara una nueva noche en el Monumental', contenido: '' }))).jpeg({ quality: 90 }).toBuffer();
  const meta = await sharp(jpeg).metadata();
  assert.equal(meta.width, 1080); assert.equal(meta.height, 1350); assert.equal(meta.format, 'jpeg'); assert.ok(jpeg.length < 8 * 1024 * 1024);
  const escaped = placaInstagram({ id: 2, titulo: '<script> & "River" ' + 'noticia '.repeat(100), contenido: '' });
  assert.ok(!escaped.includes('<script>')); assert.ok(escaped.includes('&lt;script&gt;'));
  await sharp(Buffer.from(escaped)).jpeg().toBuffer();
  if (process.env.IG_PREVIEW_FILE) await writeFile(process.env.IG_PREVIEW_FILE, jpeg);
});
