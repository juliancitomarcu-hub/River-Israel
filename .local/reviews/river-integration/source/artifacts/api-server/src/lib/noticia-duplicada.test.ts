import assert from "node:assert/strict";
import test from "node:test";
import {
  noticiaDuplicadaPorTitulo,
  normalizarTitulo,
  sonTitulosDuplicados,
} from "./noticia-duplicada";

test("no confunde una renovación con el interés de otro club por el mismo jugador", () => {
  assert.equal(
    sonTitulosDuplicados(
      "Santiago Beltrán renueva su contrato con River",
      "Juventus pregunta por Santiago Beltrán",
    ),
    false,
  );
});

test("un jugador repetido en títulos de hechos distintos no alcanza", () => {
  assert.equal(
    sonTitulosDuplicados(
      "Mastantuono fue convocado para la próxima fecha",
      "Mastantuono negocia su salida al fútbol europeo",
    ),
    false,
  );
});

test("detecta una misma noticia con títulos casi idénticos", () => {
  assert.equal(
    sonTitulosDuplicados(
      "Santiago Beltrán renueva su contrato con River",
      "Santiago Beltran renueva contrato River",
    ),
    true,
  );
});

test("los títulos cortos idénticos también se deduplican", () => {
  assert.equal(sonTitulosDuplicados("Ponzio habló", "Ponzio hablo"), true);
});

test("los tokens repetidos no inflan el solapamiento", () => {
  assert.equal(
    sonTitulosDuplicados(
      "Santiago Beltrán Santiago Beltrán renueva",
      "Santiago Beltrán Santiago Beltrán interesa",
    ),
    false,
  );
});

test("diferencias de fechas o números no se consideran la misma noticia", () => {
  assert.equal(
    sonTitulosDuplicados(
      "River prepara el partido del 10 de marzo",
      "River prepara el partido del 11 de marzo",
    ),
    false,
  );
  assert.equal(
    sonTitulosDuplicados(
      "River gana 2-1 ante Boca",
      "River gana 3-1 ante Boca",
    ),
    false,
  );
});

test("prioriza el título original y permite usar el reescrito", () => {
  assert.equal(
    noticiaDuplicadaPorTitulo("River presenta su nuevo refuerzo confirmado", {
      original: "Santiago Beltrán llega a River",
      reescrito: "River presenta su nuevo refuerzo confirmado",
    }),
    true,
  );
  assert.equal(
    noticiaDuplicadaPorTitulo("Ponzio habló", {
      original: null,
      reescrito: "Ponzio hablo",
    }),
    true,
  );
});

test("la normalización conserva números y quita diferencias tipográficas", () => {
  assert.equal(normalizarTitulo("¡River: ganó 2–1!"), "river gano 2 1");
});