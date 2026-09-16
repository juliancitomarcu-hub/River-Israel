import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuentaInstagram, validarCaption, graphInstagram, idInstagram, siguientePaso, resolverEstadoContenedor } from '../src/lib/instagram-core.ts';
const config = { INSTAGRAM_ENABLED: 'true', INSTAGRAM_API_VERSION: 'v25.0', INSTAGRAM_RIVER_USER_ID: '123', INSTAGRAM_RIVER_ACCESS_TOKEN: 'test-secret', INSTAGRAM_RIVER_START_AT: '2026-09-16T12:00:00Z' };
test('disabled/incomplete configuration and non-River categories cannot publish', () => {
  for (const category of ['seleccion', 'other']) assert.equal(cuentaInstagram(category, config), null);
  assert.equal(cuentaInstagram('river', {}), null);
  assert.equal(cuentaInstagram('river', { ...config, INSTAGRAM_ENABLED: 'false' }), null);
  assert.equal(cuentaInstagram('river', { ...config, INSTAGRAM_RIVER_START_AT: '' }), null);
  assert.equal(cuentaInstagram('river', config).id, '123');
});
test('caption rejects missing, long, HTML, Markdown and excess hashtags', () => {
  for (const text of ['', 'a'.repeat(2201), '**Titular** ' + 'a'.repeat(40), '<b>Noticia</b>' + 'a'.repeat(40), 'a'.repeat(40) + ' #a #b #c #d #e #f']) assert.throws(() => validarCaption(text));
  assert.equal(validarCaption(' Una noticia de River para compartir con la comunidad. #River '), 'Una noticia de River para compartir con la comunidad. #River');
});
test('persisted container reused and terminal jobs do not recreate posts', () => {
  assert.equal(siguientePaso({ estado: 'pendiente', container_id: null, media_id: null }), 'crear');
  assert.equal(siguientePaso({ estado: 'publicando', container_id: '42', media_id: null }), 'consultar');
  for (const estado of ['publicada', 'revision', 'fallida', 'cancelada']) assert.equal(siguientePaso({ estado, container_id: null, media_id: null }), 'terminado');
  assert.throws(() => siguientePaso({ estado: 'publicando', container_id: null, media_id: null }));
});
test('uncertain publish reconciled, never blindly repeated', () => {
  assert.equal(resolverEstadoContenedor('FINISHED', 'preparada'), 'publicar');
  assert.equal(resolverEstadoContenedor('FINISHED', 'publicando'), 'revision');
  assert.equal(resolverEstadoContenedor('PUBLISHED', 'publicando'), 'publicada');
  assert.equal(resolverEstadoContenedor('IN_PROGRESS', 'preparada'), 'esperar');
  for (const status of ['ERROR', 'EXPIRED', undefined]) assert.equal(resolverEstadoContenedor(status, 'preparada'), 'revision');
});
test('official API uses bearer auth, POST body, timeout, no redirects', async () => {
  const requests = [];
  const fetcher = async (url, opts) => { requests.push({ url: url.href, opts }); return Response.json({ id: '789' }); };
  assert.equal(idInstagram(await graphInstagram(cuentaInstagram('river', config), '123/media', 'POST', { caption: 'Texto' }, fetcher)), '789');
  assert.equal(requests[0].url, 'https://graph.instagram.com/v25.0/123/media');
  assert.equal(requests[0].opts.headers.Authorization, 'Bearer test-secret');
  assert.equal(requests[0].opts.body.get('caption'), 'Texto');
  assert.equal(requests[0].opts.redirect, 'error'); assert.ok(requests[0].opts.signal);
  await assert.rejects(graphInstagram(cuentaInstagram('river', config), '../evil', 'GET', {}, fetcher));
  assert.equal(requests.length, 1);
});
test('API errors hide tokens; malformed successes rejected', async () => {
  await assert.rejects(graphInstagram(cuentaInstagram('river', config), '123/media_publish', 'POST', {}, async () => Response.json({ error: { message: 'test-secret', code: 190 } }, { status: 401 })), e => !e.message.includes('test-secret') && e.code === 190);
  assert.throws(() => idInstagram({}));
});
