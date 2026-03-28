import { Router, type IRouter } from "express";
import healthRouter from "./health";
import redactorRouter from "./redactor";
import noticiasRouter from "./noticias";

const router: IRouter = Router();

router.use(healthRouter);
router.use(redactorRouter);
router.use(noticiasRouter);

export default router;
