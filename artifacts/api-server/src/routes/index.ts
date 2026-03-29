import { Router, type IRouter } from "express";
import healthRouter from "./health";
import redactorRouter from "./redactor";
import noticiasRouter from "./noticias";
import publicarRouter from "./publicar";
import telegramWebhookRouter from "./telegram-webhook";
import partidosRouter from "./partidos";
import storageRouter from "./storage";
import triggerRouter from "./trigger";
import historiaRouter from "./historia";
import postulacionRouter from "./postulacion";
import galeriaRouter from "./galeria";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(triggerRouter);
router.use(historiaRouter);
router.use(redactorRouter);
router.use(noticiasRouter);
router.use(publicarRouter);
router.use(telegramWebhookRouter);
router.use(partidosRouter);
router.use(postulacionRouter);
router.use(galeriaRouter);

export default router;
