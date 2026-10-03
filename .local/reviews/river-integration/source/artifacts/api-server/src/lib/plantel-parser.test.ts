import assert from "node:assert/strict";
import test from "node:test";
import { normalizarPlantelOficial, validarPlantelAlmacenado } from "./plantel-parser";

function jugador(indice: number, cambios: Record<string, unknown> = {}) {
  return {
    member_type: "squad",
    first_name: `Nombre${indice}`,
    last_name: `Apellido${indice}`,
    position: ["Arquero", "Defensor", "Mediocampista", "Delantero"][indice % 4],
    shirt_number: indice + 1,
    nationality: "Argentina",
    image: `https://images.riverplate.com/jugador-${indice}.png`,
    ...cambios,
  };
}

function respuestaValida() {
  return {
    success: true,
    data: { total_squad: 16, squad: Array.from({ length: 16 }, (_, indice) => jugador(indice)) },
  };
}

test("normaliza el contrato público del plantel oficial", () => {
  const plantel = normalizarPlantelOficial(respuestaValida(), "2026-09-15T03:13:27.000Z");

  assert.equal(plantel.jugadores.length, 16);
  assert.deepEqual(plantel.jugadores[0], {
    numero: 1,
    nombre: "Nombre0",
    apellido: "Apellido0",
    posicion: "ARQ",
    nacionalidad: "Argentina",
    foto: "https://images.riverplate.com/jugador-0.png",
  });
  assert.equal(plantel.actualizadoEn, "2026-09-15T03:13:27.000Z");
});

test("rechaza sobres oficiales fallidos o truncados", () => {
  assert.throws(
    () => normalizarPlantelOficial({ success: false, data: { total_squad: 27, squad: Array.from({ length: 27 }, (_, indice) => jugador(indice)) } }),
    /success no es true/,
  );
  for (const cantidadTruncada of [15, 26]) {
    assert.throws(
      () => normalizarPlantelOficial({
        success: true,
        data: { total_squad: 27, squad: Array.from({ length: cantidadTruncada }, (_, indice) => jugador(indice)) },
      }),
      /no coincide con total_squad/,
    );
  }
  assert.throws(
    () => normalizarPlantelOficial({ success: true, data: { squad: [jugador(1)] } }),
    /total_squad inválido/,
  );
  assert.throws(
    () => normalizarPlantelOficial({
      success: true,
      data: { total_squad: 1, squad: [jugador(1)] },
    }),
    /cantidad de jugadores insuficiente/,
  );
});

test("rechaza posiciones no oficiales", () => {
  assert.throws(
    () => normalizarPlantelOficial({
      success: true,
      data: { total_squad: 16, squad: Array.from({ length: 16 }, (_, indice) => jugador(indice, indice === 3 ? { position: "Utilero" } : {})) },
    }),
    /posición desconocida/,
  );
});

test("no acepta registros dañados al leer app_estado", () => {
  const plantel = normalizarPlantelOficial(respuestaValida());
  assert.ok(validarPlantelAlmacenado(plantel));
  assert.equal(validarPlantelAlmacenado({ ...plantel, jugadores: [] }), null);
});