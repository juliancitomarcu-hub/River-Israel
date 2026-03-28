import { Router, type IRouter } from "express";
import healthRouter from "./health";
import redactorRouter from "./redactor";
import noticiasRouter from "./noticias";
import publicarRouter from "./publicar";
import telegramWebhookRouter from "./telegram-webhook";
import partidosRouter from "./partidos";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(redactorRouter);
router.use(noticiasRouter);
router.use(publicarRouter);
router.use(telegramWebhookRouter);
router.use(partidosRouter);

export default router;
