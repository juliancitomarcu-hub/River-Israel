import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(new URL('../package.json', import.meta.url));
const { build } = require('esbuild');

test('worker delivers once, isolates account, cancels withdrawn news and reconciles timeouts', async () => {
  const db = new PGlite(), previousFetch = globalThis.fetch;
  const config = { INSTAGRAM_ENABLED: 'true', INSTAGRAM_API_VERSION: 'v25.0', INSTAGRAM_RIVER_USER_ID: '123', INSTAGRAM_RIVER_ACCESS_TOKEN: 'test-only', INSTAGRAM_RIVER_START_AT: '2026-01-01T00:00:00Z' };
  const previousEnv = Object.fromEntries(Object.keys(config).map(k => [k, process.env[k]]));
  Object.assign(process.env, config);
  let locked = false, creates = 0, publishes = 0, captions = 0, images = 0;
  let username = 'riverplateisrael', status = 'FINISHED', timeoutPublish = false;
  globalThis.__instagramTest = {
    pool: { connect: async () => ({
      query: async (sql, args) => {
        if (sql.includes('pg_try_advisory_lock')) { const acquired = !locked; locked = true; return { rows: [{ locked: acquired }] }; }
        if (sql.includes('pg_advisory_unlock')) { locked = false; return { rows: [] }; }
        return db.query(sql, args);
      }, release() {},
    }) },
    caption: async () => { captions++; return 'River: una noticia para la comunidad. Leé más en nuestra web. #River'; },
    image: async () => { images++; return 'https://example.org/card.jpg'; },
  };
  globalThis.fetch = async (url, opts) => {
    assert.equal(url.hostname, 'graph.instagram.com');
    if (url.pathname.endsWith('/123') && opts.method === 'GET') return Response.json({ id: '123', username });
    if (url.pathname.endsWith('/media')) { creates++; return Response.json({ id: '456' }); }
    if (url.pathname.endsWith('/media_publish')) { publishes++; if (timeoutPublish) throw new Error('timeout'); return Response.json({ id: '789' }); }
    if (url.pathname.endsWith('/456')) return Response.json({ status_code: status });
    throw new Error('Unexpected request');
  };
  try {
    await db.exec("CREATE TABLE noticias (id serial PRIMARY KEY, titulo text DEFAULT 'River', contenido text DEFAULT 'Contenido', publicada boolean NOT NULL DEFAULT false, categoria text NOT NULL DEFAULT 'river');");
    await db.exec(await readFile(new URL('../../../lib/db/migrations/20260916_instagram.sql', import.meta.url), 'utf8'));
    const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/instagram-worker.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'isolated-services', setup(b) {
      b.onResolve({ filter: /^(@workspace\/db|\.\/logger|\.\/instagram-editorial)$/ }, args => ({ path: args.path, namespace: 'test' }));
      b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === '@workspace/db' ? 'export const pool = globalThis.__instagramTest.pool'
        : args.path === './logger' ? 'export const logger = { warn() {}, error() {} }'
        : 'export const generarCaptionInstagram = globalThis.__instagramTest.caption; export const generarPlacaInstagram = globalThis.__instagramTest.image;' }));
    } }] });
    const { procesarInstagram } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
    const add = async () => (await db.query('INSERT INTO noticias(publicada) VALUES (true) RETURNING id')).rows[0].id;
    const job = async id => (await db.query('SELECT * FROM instagram_publicaciones WHERE noticia_id = $1', [id])).rows[0];
    const retryTime = async id => db.query('UPDATE instagram_publicaciones SET next_attempt_at = now() WHERE noticia_id = $1', [id]);
    const id1 = await add();
    await Promise.all([procesarInstagram(), procesarInstagram()]);
    assert.equal((await job(id1)).estado, 'publicada'); assert.equal((await job(id1)).media_id, '789');
    await procesarInstagram(); assert.equal(publishes, 1); assert.equal(creates, 1);
    const id2 = await add(); timeoutPublish = true; await procesarInstagram();
    assert.equal((await job(id2)).estado, 'publicando');
    status = 'PUBLISHED'; timeoutPublish = false; await retryTime(id2); await procesarInstagram();
    assert.equal((await job(id2)).estado, 'publicada'); assert.equal(publishes, 2);
    assert.equal(creates, 2); assert.equal(captions, 2); assert.equal(images, 2);
    const id3 = await add(); username = 'wrong-account'; await procesarInstagram();
    assert.equal((await job(id3)).estado, 'revision'); assert.equal(creates, 2);
    username = 'riverplateisrael'; status = 'FINISHED';
    const id4 = await add(); await db.query('UPDATE noticias SET publicada = false WHERE id = $1', [id4]); await procesarInstagram();
    assert.equal((await job(id4)).estado, 'cancelada'); assert.equal(publishes, 2);
    const id5 = await add(); timeoutPublish = true; await procesarInstagram();
    await retryTime(id5); timeoutPublish = false; await procesarInstagram();
    assert.equal((await job(id5)).estado, 'revision'); assert.equal(publishes, 3);
    const id6 = await add(); await db.query("UPDATE instagram_publicaciones SET created_at = '2025-01-01' WHERE noticia_id = $1", [id6]);
    await procesarInstagram(); assert.equal((await job(id6)).estado, 'pendiente'); assert.equal(publishes, 3);
    await db.exec("INSERT INTO noticias(publicada, categoria) VALUES (true, 'seleccion')");
    await procesarInstagram(); assert.equal(publishes, 3);
  } finally {
    globalThis.fetch = previousFetch; delete globalThis.__instagramTest;
    for (const [k, v] of Object.entries(previousEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await db.close();
  }
});
