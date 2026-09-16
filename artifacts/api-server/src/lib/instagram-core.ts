export interface CuentaIG { id: string; token: string; version: string; desde: string }

export function cuentaInstagram(categoria: string, env: NodeJS.ProcessEnv = process.env): CuentaIG | null {
  // Only River / @riverplateisrael is authorized.
  if (env.INSTAGRAM_ENABLED !== "true" || categoria !== "river") return null;
  const id = env.INSTAGRAM_RIVER_USER_ID, token = env.INSTAGRAM_RIVER_ACCESS_TOKEN;
  const desde = env.INSTAGRAM_RIVER_START_AT, version = env.INSTAGRAM_API_VERSION;
  if (!id || !/^\d+$/.test(id) || !token || !desde || !/Z$/.test(desde) || !Number.isFinite(Date.parse(desde)) || !version || !/^v\d+\.0$/.test(version)) return null;
  return { id, token, version, desde };
}
export function validarCaption(raw: string): string {
  const caption = raw.trim();
  if (caption.length < 30 || Array.from(caption).length > 2200 || /<[^>]+>|\*\*/.test(caption) || (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 5) {
    throw new Error("El texto generado no cumple el formato de Instagram");
  }
  return caption;
}
export class InstagramError extends Error {
  code: number; status: number;
  constructor(code: number, status: number) {
    super(`Instagram rechazó la operación (HTTP ${status}, código ${code})`);
    this.code = code; this.status = status;
  }
}
export async function graphInstagram(cuenta: CuentaIG, path: string, method: "GET" | "POST", params: Record<string, string>, fetcher: typeof fetch = fetch): Promise<Record<string, unknown>> {
  if (!/^[\d/]+(?:media|media_publish)?$/.test(path)) throw new Error("Ruta Instagram inválida");
  const url = new URL(`https://graph.instagram.com/${cuenta.version}/${path}`);
  if (method === "GET") url.search = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetcher(url, { method,
      headers: { Authorization: `Bearer ${cuenta.token}`, "Content-Type": "application/x-www-form-urlencoded" },
      ...(method === "POST" ? { body: new URLSearchParams(params) } : {}),
      signal: AbortSignal.timeout(30_000), redirect: "error" });
  } catch { throw new Error("Instagram: respuesta de red no confirmada"); }
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || data.error) {
    const error = data.error as { code?: number } | undefined;
    throw new InstagramError(Number(error?.code ?? 0), res.status);
  }
  return data;
}
export function idInstagram(data: Record<string, unknown>): string {
  if (typeof data.id !== "string" || !/^\d+$/.test(data.id)) throw new Error("Instagram no devolvió un identificador válido");
  return data.id;
}
export function siguientePaso(job: { estado: string; container_id: string | null; media_id: string | null }): "crear" | "consultar" | "terminado" {
  if (job.media_id || ["publicada", "revision", "fallida", "cancelada"].includes(job.estado)) return "terminado";
  if (job.container_id) return "consultar";
  if (job.estado === "publicando") throw new Error("Publicación incierta sin contenedor");
  return "crear";
}
export function resolverEstadoContenedor(status: unknown, estado: string): "publicar" | "publicada" | "esperar" | "revision" {
  if (status === "PUBLISHED") return "publicada";
  // Never blindly repeat a publish after a crash or timeout.
  if (estado === "publicando") return status === "IN_PROGRESS" ? "esperar" : "revision";
  if (status === "FINISHED") return "publicar";
  return status === "IN_PROGRESS" ? "esperar" : "revision";
}
