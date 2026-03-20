import { Router, type IRouter } from "express";
import healthRouter from "./health";
import outfitRouter from "./outfit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(outfitRouter);

export default router;
