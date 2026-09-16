import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Ejecuta el router real sin base de datos ni mensajes a chats reales.
const result = await build({
  entryPoints: ["src/routes/redactor-settings.ts"],
  bundle: true, write: false, platform: "node", format: "cjs",
  plugins: [{
    name: "fakes",
    setup(b) {
      b.onResolve({ filter: /^(express|drizzle-orm|@workspace\/db)$|\/(requireAdmin|redactor-settings|resumen-pendientes|edit-tokens|telegram-cred)$/ }, args => {
        if (args.kind === "entry-point") return;
        return { path: args.path, namespace: "fake" };
      });
      b.onLoad({ filter: /.*/, namespace: "fake" }, ({ path }) => ({
        contents: path === "express" ? `exports.Router = () => globalThis.__linksTest.router;`
          : path === "@workspace/db" ? `exports.db = globalThis.__linksTest.db; exports.editTokensTable = {}; exports.noticiasTable = {};`
          : path === "drizzle-orm" ? `for (const key of ["and","desc","eq","gt","isNotNull","isNull"]) exports[key] = () => ({});`
          : path.endsWith("requireAdmin") ? `exports.requireAdmin = () => {};`
          : path.endsWith("edit-tokens") ? `exports.createEditToken = async id => { globalThis.__linksTest.created.push(id); return "test-token"; }; exports.descripcionTtlEdicion = () => "45 minutos";`
          : path.endsWith("telegram-cred") ? `exports.credencialesTelegram = category => { globalThis.__linksTest.category = category; return globalThis.__linksTest.credentials; };`
          : path.endsWith("resumen-pendientes") ? `exports.contarPendientesResumen = async () => ({});`
          : `exports.leerRedactorSettings = () => ({});`,
      }));
    },
  }],
});

test("reemplazos: validación, categoría, entrega y errores", async () => {
  let handler;
  const state = {
    created: [], category: null, deleted: 0,
    credentials: { token: "fake", chatId: "123", marca: "Prueba" },
    rows: [],
    router: { use() {}, get() {}, put() {}, delete() {}, post(_path, fn) { handler = fn; } },
    db: {
      select() {
        const rows = state.rows.shift();
        return { from: () => ({ where: () => Object.assign(Promise.resolve(rows), { limit: async () => rows }) }) };
      },
      delete() { state.deleted++; return { where: async () => {} }; },
    },
  };
  globalThis.__linksTest = state;
  new Function("module", "exports", result.outputFiles[0].text)({ exports: {} }, {});
  const originalFetch = globalThis.fetch;
  let payload;
  globalThis.fetch = async (_url, opts) => {
    payload = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const call = async id => {
    const res = { code: 200, status(n) { this.code = n; return this; }, json(body) { this.body = body; } };
    await handler({ params: { noticiaId: id }, log: { info() {}, warn() {} } }, res);
    return res;
  };
  const note = category => ({ id: 4, titulo: "*Título* [sin formato]", categoria: category });
  const link = { createdAt: new Date(), expiresAt: new Date(Date.now() + 2700000) };
  try {
    assert.equal((await call("no")).code, 400);
    assert.equal((await call("0")).code, 400);
    state.rows = [[]];
    assert.equal((await call("4")).code, 404);
    for (const category of ["river", "seleccion"]) {
      state.rows = [[note(category)], [link]];
      const res = await call("4");
      assert.equal(res.code, 201);
      assert.equal(state.category, category);
      assert.equal(res.body.link.expiraEn, link.expiresAt.toISOString());
      assert.equal(res.body.link.noticiaId, 4);
      assert.match(payload.text, /45 minutos/);
      assert.equal(payload.parse_mode, undefined);
      assert.match(payload.reply_markup.inline_keyboard[0][0].url, /editar=4&edit_token=test-token$/);
    }
    state.credentials = null;
    state.rows = [[note("river")]];
    assert.equal((await call("4")).code, 503);
    assert.equal(state.created.length, 2);
    state.credentials = { token: "fake", chatId: "123", marca: "Prueba" };
    for (const failure of ["rejected", "timeout"]) {
      globalThis.fetch = async () => {
        if (failure === "timeout") throw new Error("timeout");
        return { ok: true, json: async () => ({ ok: false }) };
      };
      state.rows = [[note("river")], [link]];
      assert.equal((await call("4")).code, 502);
    }
    assert.equal(state.deleted, 2);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__linksTest;
  }
});