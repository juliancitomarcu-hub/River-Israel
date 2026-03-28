import { Router, type IRouter } from "express";
import healthRouter from "./health";
import redactorRouter from "./redactor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(redactorRouter);

export default router;
