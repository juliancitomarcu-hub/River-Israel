import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getNoticiaSession } from "../lib/edit-tokens";

function extractToken(req: Request): string | undefined {
  const header = req.header("x-admin-token");
  const query = typeof req.query.token === "string" ? req.query.token : undefined;
  return header ?? query;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    req.log.error("ADMIN_TOKEN no está configurado — rechazando acceso admin");
    res.status(503).json({ error: "Auth admin no configurada en el servidor" });
    return;
  }
  const provided = extractToken(req);
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  next();
}

// Permite acceso si:
//  - viene el ADMIN_TOKEN permanente, O
//  - viene un session token efímero (canjeado desde un edit_token de Telegram)
//    que está scoped a la MISMA noticiaId que la del request.
// Los session tokens NO sirven para ningún otro recurso ni endpoint admin.
// Acepta ADMIN_TOKEN o cualquier sesión scoped válida (sin verificar a qué
// nota está scoped). Sólo usar en endpoints que no actúan sobre una nota
// específica pero que necesita el flujo de edición (ej: pedir presigned URL
// de upload para la foto de portada).
export function requireAdminOrAnyNoticiaSession(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    req.log.error("ADMIN_TOKEN no está configurado — rechazando acceso admin");
    res.status(503).json({ error: "Auth admin no configurada en el servidor" });
    return;
  }
  const provided = extractToken(req);
  if (!provided) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  if (provided === expected) { next(); return; }
  if (getNoticiaSession(provided)) { next(); return; }
  res.status(401).json({ error: "No autorizado" });
}

export function requireAdminOrNoticiaSession(getNoticiaId: (req: Request) => number | null): RequestHandler {
  return (req, res, next) => {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      req.log.error("ADMIN_TOKEN no está configurado — rechazando acceso admin");
      res.status(503).json({ error: "Auth admin no configurada en el servidor" });
      return;
    }
    const provided = extractToken(req);
    if (!provided) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }
    if (provided === expected) {
      next();
      return;
    }
    const session = getNoticiaSession(provided);
    if (!session) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }
    const reqNoticiaId = getNoticiaId(req);
    if (reqNoticiaId === null || reqNoticiaId !== session.noticiaId) {
      res.status(403).json({ error: "Sesión no autorizada para este recurso" });
      return;
    }
    next();
  };
}
