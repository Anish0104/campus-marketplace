import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireUser, requireAdmin } from "../middleware/requireUser";
import { User } from "../models/User";
import { Listing } from "../models/Listing";
import { MarketplaceRules, RULES_MAX_LENGTH } from "../models/MarketplaceRules";
import { listingValidationError } from "../services/listingValidation";

export const adminRouter = Router();
adminRouter.use(requireUser, requireAdmin);
adminRouter.param("id", (_req, res, next, id) => {
  if (!isValidObjectId(id)) { res.status(400).json({ error: "Invalid identifier." }); return; }
  next();
});
// Bounded pagination shared by management lists.
adminRouter.use((req, res, next) => {
  const raw = req.query.page ?? "1";
  if (typeof raw !== "string" || !/^[1-9]\d{0,5}$/.test(raw)) {
    res.status(400).json({ error: "Page must be a positive integer up to 999999." }); return;
  }
  res.locals.page = Number(raw);
  next();
});
adminRouter.get("/users", async (_req, res) => {
  const page = res.locals.page as number;
  const [users, total] = await Promise.all([
    User.find().select("name email username role suspended createdAt").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean(),
    User.countDocuments(),
  ]);
  res.json({ users, total, page, totalPages: Math.ceil(total / 20) });
});
adminRouter.patch("/users/:id", async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.suspended !== "boolean" || Object.keys(body).some((key) => key !== "suspended")) {
    res.status(400).json({ error: "Only a boolean suspended field may be changed." }); return;
  }
  // Role in the update filter also protects against concurrent role changes.
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: "student" },
    { $set: { suspended: body.suspended } }, { returnDocument: "after" }).select("name email role suspended");
  if (!user) { res.status(404).json({ error: "Student account not found. Administrator accounts cannot be suspended." }); return; }
  if (user.suspended) req.app.get("io")?.in(`user:${user.id}`).disconnectSockets(true);
  res.json(user);
});
adminRouter.get("/listings", async (_req, res) => {
  const page = res.locals.page as number;
  const [listings, total] = await Promise.all([
    Listing.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean(), Listing.countDocuments(),
  ]);
  res.json({ listings, total, page, totalPages: Math.ceil(total / 20) });
});
adminRouter.patch("/listings/:id", async (req, res) => {
  const body = req.body ?? {};
  const fields = ["title", "description", "price", "category", "condition", "status"];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !fields.includes(key))) {
    res.status(400).json({ error: "Only listing text, price, category, condition and status may be edited." }); return;
  }
  const listing = await Listing.findById(req.params.id);
  if (!listing) { res.status(404).json({ error: "Listing not found." }); return; }
  const error = listingValidationError({ ...listing.toObject(), ...body });
  if (error || (body.status !== undefined && !["active", "sold", "removed"].includes(body.status))) {
    res.status(400).json({ error: error ?? "Invalid listing status." }); return;
  }
  listing.set(body);
  await listing.save();
  res.json(listing);
});
adminRouter.put("/rules", async (req, res) => {
  const content = req.body?.content;
  if (typeof content !== "string" || !content.trim() || content.trim().length > RULES_MAX_LENGTH) {
    res.status(400).json({ error: `Rules must contain 1 to ${RULES_MAX_LENGTH} characters.` }); return;
  }
  const rules = await MarketplaceRules.findByIdAndUpdate("marketplace",
    { $set: { content: content.trim(), updatedBy: req.userId } }, { upsert: true, returnDocument: "after", runValidators: true });
  res.json({ content: rules!.content, updatedAt: rules!.updatedAt });
});
