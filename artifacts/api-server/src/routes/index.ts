import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import spamRouter from "./spam";
import settingsRouter from "./settings";
import allowlistRouter from "./allowlist";
import accountRouter from "./account";
import { loadUser } from "../lib/session";

const router: IRouter = Router();

router.use(healthRouter);
router.use(loadUser);
router.use(authRouter);
router.use(spamRouter);
router.use(settingsRouter);
router.use(allowlistRouter);
router.use(accountRouter);

export default router;
