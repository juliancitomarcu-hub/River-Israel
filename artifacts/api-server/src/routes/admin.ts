import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/requireAdmin";

const router: IRouter = Router();

router.get("/admin/check", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

export default router;
