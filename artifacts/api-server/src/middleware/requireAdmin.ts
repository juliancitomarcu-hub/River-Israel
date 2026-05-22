import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    req.log.error("ADMIN_TOKEN no está configurado — rechazando acceso admin");
    res.status(503).json({ error: "Auth admin no configurada en el servidor" });
    return;
  }
  const header = req.header("x-admin-token");
  const query = typeof req.query.token === "string" ? req.query.token : undefined;
  const provided = header ?? query;
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  next();
}
