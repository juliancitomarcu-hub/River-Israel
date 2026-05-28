import { Router, type IRouter } from "express";
import * as fs from "fs";
import * as path from "path";
import { getAdminSession } from "../lib/edit-tokens";

const router: IRouter = Router();

const FILE = path.resolve("./mundial-resultados.json");

const ESTADOS = ["PROXIMO", "EN_VIVO", "FINALIZADO"] as const;
type Estado = typeof ESTADOS[number];

export interface ResultadoMundial {
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: Estado;
  minuto?: string;
  notas?: string;
  actualizadoEn?: string;
}

type Store = Record<string, ResultadoMundial>;

function validar(input: unknown): { ok: true; data: ResultadoMundial } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Body debe ser objeto" };
  const o = input as Record<string, unknown>;
  const gl = o.golesLocal;
  const gv = o.golesVisitante;
  const estado = o.estado;
  const checkGol = (v: unknown): v is number | null =>
    v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 99);
  if (!checkGol(gl)) return { ok: false, error: "golesLocal inválido (0-99 o null)" };
  if (!checkGol(gv)) return { ok: false, error: "golesVisitante inválido (0-99 o null)" };
  if (typeof estado !== "string" || !ESTADOS.includes(estado as Estado))
    return { ok: false, error: `estado debe ser uno de ${ESTADOS.join(",")}` };
  const minuto = typeof o.minuto === "string" ? o.minuto.slice(0, 20) : undefined;
  const notas = typeof o.notas === "string" ? o.notas.slice(0, 280) : undefined;
  return {
    ok: true,
    data: {
      golesLocal: gl,
      golesVisitante: gv,
      estado: estado as Estado,
      ...(minuto ? { minuto } : {}),
      ...(notas ? { notas } : {}),
    },
  };
}

function leer(): Store {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function escribir(store: Store): void {
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2), "utf-8");
}

function autorizado(req: Parameters<Parameters<IRouter["get"]>[1]>[0]): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const provided = req.header("x-admin-token");
  if (!provided) return false;
  if (provided === expected) return true;
  return getAdminSession(provided) !== null;
}

router.get("/mundial/resultados", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const store = leer();
  res.json({ resultados: store, actualizadoEn: new Date().toISOString() });
});

router.post("/mundial/resultado/:id", (req, res) => {
  if (!autorizado(req)) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "Falta el id del partido" });
    return;
  }
  const parsed = validar(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const store = leer();
  store[id] = { ...parsed.data, actualizadoEn: new Date().toISOString() };
  escribir(store);
  req.log.info({ id, estado: parsed.data.estado }, "Resultado Mundial actualizado");
  res.json({ ok: true, id, resultado: store[id] });
});

router.delete("/mundial/resultado/:id", (req, res) => {
  if (!autorizado(req)) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  const id = String(req.params.id ?? "").trim();
  const store = leer();
  if (!(id in store)) {
    res.status(404).json({ error: "Partido no encontrado" });
    return;
  }
  delete store[id];
  escribir(store);
  res.json({ ok: true });
});

export default router;
