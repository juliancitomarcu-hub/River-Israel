import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('PostgreSQL trigger captures all publication paths atomically, excludes old/Selección and duplicates', async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE noticias (id serial PRIMARY KEY, titulo text, publicada boolean NOT NULL DEFAULT false, categoria text NOT NULL DEFAULT 'river'); INSERT INTO noticias(titulo, publicada) VALUES ('Histórica', true);");
    const sql = await readFile(new URL('../../../lib/db/migrations/20260916_instagram.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    const count = async () => (await db.query('SELECT * FROM instagram_publicaciones')).rows.length;
    assert.equal(await count(), 0);
    await db.exec("INSERT INTO noticias(titulo, publicada) VALUES ('Panel', true), ('Scheduler', true), ('Telegram', false); INSERT INTO noticias(titulo, publicada, categoria) VALUES ('Selección', true, 'seleccion'); UPDATE noticias SET publicada = true WHERE titulo = 'Telegram';");
    assert.equal(await count(), 3);
    await db.exec("UPDATE noticias SET publicada = true WHERE titulo = 'Panel'; UPDATE noticias SET publicada = false WHERE titulo = 'Panel'; UPDATE noticias SET publicada = true WHERE titulo = 'Panel';");
    assert.equal(await count(), 3);
    await db.exec("BEGIN; INSERT INTO noticias(titulo, publicada) VALUES ('Rollback', true); ROLLBACK;");
    assert.equal(await count(), 3);
    await db.exec("DELETE FROM noticias WHERE titulo = 'Panel';"); assert.equal(await count(), 2);
  } finally { await db.close(); }
});
