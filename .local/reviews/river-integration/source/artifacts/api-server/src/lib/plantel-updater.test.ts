import assert from "node:assert/strict";
import test from "node:test";
import { actualizarPlantelConDependencias } from "./plantel-updater";
import { normalizarPlantelOficial, type PlantelProfesional } from "./plantel-parser";

function jugador(indice: number) {
  return {
    member_type: "squad",
    first_name: `Nombre${indice}`,
    last_name: `Apellido${indice}`,
    position: ["Arquero", "Defensor", "Mediocampista", "Delantero"][indice % 4],
    shirt_number: indice + 1,
    nationality: "Argentina",
    image: `https://images.riverplate.com/jugador-${indice}.png`,
  };
}

function respuestaValida(cantidad = 27, total = cantidad) {
  return {
    success: true,
    data: { total_squad: total, squad: Array.from({ length: cantidad }, (_, indice) => jugador(indice)) },
  };
}

function plantelPrevio(): PlantelProfesional {
  return normalizarPlantelOficial(respuestaValida(), "2026-09-14T00:00:00.000Z");
}

async function fallaSinReemplazarAnterior(
  fetch: () => Promise<Response>,
  error: RegExp,
  persistir: () => Promise<boolean> = async () => true,
  esperaIntentoPersistencia = false,
): Promise<void> {
  let estado: PlantelProfesional = plantelPrevio();
  let escrituras = 0;
  const previo = estado;

  await assert.rejects(
    actualizarPlantelConDependencias({
      fetch: async () => fetch(),
      guardarEstado: async (_clave, plantel) => {
        escrituras++;
        const guardado = await persistir();
        if (guardado) estado = plantel;
        return guardado;
      },
      claveEstado: "plantel_profesional",
      ahora: () => "2026-09-15T00:00:00.000Z",
    }),
    error,
  );

  assert.equal(estado, previo, "un fallo debe conservar el registro previo");
  assert.equal(escrituras, esperaIntentoPersistencia ? 1 : 0, "solo los fallos de persistencia pueden intentar escribir");
}

test("los fallos HTTP, JSON y validación conservan el último plantel", async () => {
  await fallaSinReemplazarAnterior(
    async () => new Response("error", { status: 502 }),
    /HTTP 502/,
  );
  await fallaSinReemplazarAnterior(
    async () => new Response("{", { status: 200, headers: { "Content-Type": "application/json" } }),
    /JSON inválido/,
  );
  // total_squad real de la respuesta oficial es 27: 15–26 jugadores sería
  // una respuesta truncada aunque todos sus registros individuales sean válidos.
  await fallaSinReemplazarAnterior(
    async () => new Response(JSON.stringify(respuestaValida(26, 27)), { status: 200 }),
    /no coincide con total_squad/,
  );
  await fallaSinReemplazarAnterior(
    async () => new Response(JSON.stringify(respuestaValida(1, 1)), { status: 200 }),
    /cantidad de jugadores insuficiente/,
  );
});

test("un error de persistencia conserva el último plantel", async () => {
  await fallaSinReemplazarAnterior(
    async () => new Response(JSON.stringify(respuestaValida()), { status: 200 }),
    /No se pudo persistir/,
    async () => false,
    true,
  );
  await fallaSinReemplazarAnterior(
    async () => new Response(JSON.stringify(respuestaValida()), { status: 200 }),
    /DB no disponible/,
    async () => {
      throw new Error("DB no disponible");
    },
    true,
  );
});

test("persiste solamente un sobre oficial completo y válido", async () => {
  let estado: PlantelProfesional | null = null;
  const plantel = await actualizarPlantelConDependencias({
    fetch: async () => new Response(JSON.stringify(respuestaValida()), { status: 200 }),
    guardarEstado: async (_clave, nuevo) => {
      estado = nuevo;
      return true;
    },
    claveEstado: "plantel_profesional",
    ahora: () => "2026-09-15T00:00:00.000Z",
  });

  assert.equal(estado, plantel);
  assert.equal(plantel.jugadores.length, 27);
});