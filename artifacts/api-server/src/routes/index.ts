import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import spamRouter from "./spam";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(spamRouter);
router.use(settingsRouter);

export default router;
