import { Schema, model } from "mongoose";

export const DEFAULT_RULES = "Be respectful. List only items you own and describe them honestly. No illegal, dangerous, or prohibited goods. Arrange exchanges in a safe public place on campus.";
export const RULES_MAX_LENGTH = 10000;
export const MarketplaceRules = model("MarketplaceRules", new Schema({
  _id: { type: String, default: "marketplace" },
  content: { type: String, required: true, maxlength: RULES_MAX_LENGTH },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true }));
