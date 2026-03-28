import { Router, type IRouter } from "express";
import healthRouter from "./health";
import redactorRouter from "./redactor";
import noticiasRouter from "./noticias";
import publicarRouter from "./publicar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(redactorRouter);
router.use(noticiasRouter);
router.use(publicarRouter);

export default router;
