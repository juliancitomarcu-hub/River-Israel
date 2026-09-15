export const FUENTE_PLANTEL_OFICIAL =
  "https://www.riverplate.com/futbol/futbol-profesional/masculino/plantel";

export const API_PLANTEL_OFICIAL =
  "https://www.riverplate.com/api/v1/sports/male-professional-football/squad";

export type PosicionPlantel = "ARQ" | "DEF" | "MED" | "DEL";

export interface JugadorPlantel {
  numero: number | null;
  nombre: string;
  apellido: string;
  posicion: PosicionPlantel;
  nacionalidad: string;
  foto: string;
}

export interface PlantelProfesional {
  jugadores: JugadorPlantel[];
  actualizadoEn: string;
  fuente: string;
}

interface JugadorOficial {
  member_type?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  position?: unknown;
  shirt_number?: unknown;
  nationality?: unknown;
  image?: unknown;
}

const POSICIONES: Record<string, PosicionPlantel> = {
  arquero: "ARQ",
  portero: "ARQ",
  defensor: "DEF",
  mediocampista: "MED",
  volante: "MED",
  delantero: "DEL",
  atacante: "DEL",
};

function textoObligatorio(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new Error(`Plantel oficial inválido: falta ${campo}`);
  }
  return valor.trim();
}

function numeroCamiseta(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isInteger(numero) || numero < 0 || numero > 99) {
    throw new Error("Plantel oficial inválido: número de camiseta inválido");
  }
  return numero;
}

function fotoSegura(valor: unknown): string {
  const foto = textoObligatorio(valor, "foto");
  let url: URL;
  try {
    url = new URL(foto);
  } catch {
    throw new Error("Plantel oficial inválido: foto no es una URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Plantel oficial inválido: foto debe usar HTTPS");
  }
  return url.toString();
}

function posicionOficial(valor: unknown): PosicionPlantel {
  const posicion = textoObligatorio(valor, "posición")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const normalizada = POSICIONES[posicion];
  if (!normalizada) {
    throw new Error(`Plantel oficial inválido: posición desconocida (${String(valor)})`);
  }
  return normalizada;
}

/**
 * Converts the public River API response into the deliberately small contract
 * exposed by this service. A partial or structurally changed response is
 * rejected as a whole, so it can never replace the last verified roster.
 */
export function normalizarPlantelOficial(payload: unknown, actualizadoEn = new Date().toISOString()): PlantelProfesional {
  const respuesta = payload as {
    success?: unknown;
    data?: { squad?: unknown; total_squad?: unknown };
  } | null;
  if (respuesta?.success !== true) {
    throw new Error("Plantel oficial inválido: success no es true");
  }

  const squad = respuesta?.data?.squad;
  if (!Array.isArray(squad)) {
    throw new Error("Plantel oficial inválido: no se encontró data.squad");
  }

  const totalSquad = respuesta.data?.total_squad;
  if (!Number.isInteger(totalSquad) || (totalSquad as number) < 1) {
    throw new Error("Plantel oficial inválido: total_squad inválido");
  }
  const totalSquadDeclarado = Number(totalSquad);
  if (squad.length !== totalSquadDeclarado) {
    throw new Error(`Plantel oficial inválido: squad (${squad.length}) no coincide con total_squad (${totalSquadDeclarado})`);
  }
  // total_squad is supplied by the remote service, so retain an independent
  // floor as a sanity check against a self-consistent but bad upstream payload.
  if (totalSquadDeclarado < 15) {
    throw new Error("Plantel oficial inválido: cantidad de jugadores insuficiente");
  }

  const jugadores = squad.map((valor): JugadorPlantel => {
    if (typeof valor !== "object" || valor === null || (valor as JugadorOficial).member_type !== "squad") {
      throw new Error("Plantel oficial inválido: miembro de squad inválido");
    }
    const jugador = valor as JugadorOficial;
    return {
      numero: numeroCamiseta(jugador.shirt_number),
      nombre: textoObligatorio(jugador.first_name, "nombre"),
      apellido: textoObligatorio(jugador.last_name, "apellido"),
      posicion: posicionOficial(jugador.position),
      nacionalidad: textoObligatorio(jugador.nationality, "nacionalidad"),
      foto: fotoSegura(jugador.image),
    };
  });

  const nombres = new Set<string>();
  for (const jugador of jugadores) {
    const clave = `${jugador.nombre.toLocaleLowerCase("es-AR")}|${jugador.apellido.toLocaleLowerCase("es-AR")}`;
    if (nombres.has(clave)) {
      throw new Error(`Plantel oficial inválido: jugador duplicado (${jugador.nombre} ${jugador.apellido})`);
    }
    nombres.add(clave);
  }

  const fecha = new Date(actualizadoEn);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error("Plantel oficial inválido: fecha de actualización inválida");
  }

  return {
    jugadores,
    actualizadoEn: fecha.toISOString(),
    fuente: FUENTE_PLANTEL_OFICIAL,
  };
}

/** Validates records read from app_estado before returning them to callers. */
export function validarPlantelAlmacenado(valor: unknown): PlantelProfesional | null {
  try {
    const plantel = valor as PlantelProfesional;
    if (!plantel || !Array.isArray(plantel.jugadores) || typeof plantel.actualizadoEn !== "string") {
      return null;
    }
    return normalizarPlantelOficial(
      { success: true, data: {
        total_squad: plantel.jugadores.length,
        squad: plantel.jugadores.map((jugador) => ({
        member_type: "squad",
        first_name: jugador.nombre,
        last_name: jugador.apellido,
        position: ({ ARQ: "Arquero", DEF: "Defensor", MED: "Mediocampista", DEL: "Delantero" } as const)[jugador.posicion],
        shirt_number: jugador.numero,
        nationality: jugador.nacionalidad,
        image: jugador.foto,
        })),
      } },
      plantel.actualizadoEn,
    );
  } catch {
    return null;
  }
}