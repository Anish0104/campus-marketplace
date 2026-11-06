import { Router } from "express";
import { MarketplaceRules, DEFAULT_RULES } from "../models/MarketplaceRules";
export const rulesRouter = Router();
rulesRouter.get("/", async (_req, res) => {
  const rules = await MarketplaceRules.findById("marketplace");
  res.json({ content: rules?.content ?? DEFAULT_RULES, updatedAt: rules?.updatedAt ?? null });
});
