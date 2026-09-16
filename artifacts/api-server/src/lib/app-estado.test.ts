import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost:5432/app-estado-test";

const { clasificarErrorDb, esErrorDbTransitorio } = await import("./app-estado");

test("clasifica un timeout de autenticación como reintentable", () => {
  const resultado = clasificarErrorDb(new Error("Authentication timed out while connecting"));

  assert.equal(resultado.reintentar, true);
  assert.equal(resultado.clasificacion, "transient_auth_timeout");
  assert.equal(esErrorDbTransitorio(new Error("connect ETIMEDOUT")), true);
  assert.equal(esErrorDbTransitorio(new Error("timeout expired")), true);
});

test("no reintenta credenciales incorrectas", () => {
  const resultado = clasificarErrorDb({
    code: "28P01",
    message: "password authentication failed for user",
  });

  assert.equal(resultado.reintentar, false);
  assert.equal(resultado.clasificacion, "authentication");
  assert.equal(resultado.sqlState, "28P01");
});

test("no reintenta permisos ni esquemas ausentes", () => {
  assert.equal(
    clasificarErrorDb({ code: "42501", message: "permission denied for table app_estado" }).reintentar,
    false,
  );
  assert.equal(
    clasificarErrorDb({ code: "3F000", message: "schema does not exist" }).reintentar,
    false,
  );
});

test("lee causas anidadas sin exponerlas ni exigir una forma única de error", () => {
  const resultado = clasificarErrorDb({
    message: "query failed",
    cause: {
      code: "08006",
      message: "connection failure",
    },
  });

  assert.equal(resultado.reintentar, true);
  assert.equal(resultado.clasificacion, "transient_connection");
  assert.equal(resultado.sqlState, "08006");
});

test("un rechazo de autenticación en una causa no se convierte en reintento", () => {
  const resultado = clasificarErrorDb({
    message: "database operation failed",
    cause: {
      code: "28P01",
      message: "password authentication failed",
    },
  });

  assert.equal(resultado.reintentar, false);
  assert.equal(resultado.clasificacion, "authentication");
  assert.equal(resultado.sqlState, "28P01");
});