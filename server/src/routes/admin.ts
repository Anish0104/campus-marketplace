import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireUser, requireAdmin } from "../middleware/requireUser";
import { User } from "../models/User";
import { Listing } from "../models/Listing";
import { MarketplaceRules, RULES_MAX_LENGTH } from "../models/MarketplaceRules";
import { Flag, FLAG_STATUSES, type FlagStatus } from "../models/Flag";
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
// --- Moderation queue (Kunal) ---------------------------------------------
// Open flags newest first, with enough of each target to decide without
// leaving the page. A removed listing or a deleted account leaves its flags
// behind, so `target` may be null; the client shows those as unavailable.
adminRouter.get("/flags", async (req, res) => {
  const page = res.locals.page as number;
  const requested = typeof req.query.status === "string" ? req.query.status : "open";
  if (!FLAG_STATUSES.includes(requested as FlagStatus)) {
    res.status(400).json({ error: "Status must be open, dismissed or actioned." });
    return;
  }
  const status = requested as FlagStatus;
  const [flags, total] = await Promise.all([
    Flag.find({ status })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .populate("reporter", "name")
      .populate("target", "title status seller name suspended")
      .lean(),
    Flag.countDocuments({ status }),
  ]);
  res.json({ flags, total, page, totalPages: Math.ceil(total / 20) });
});

/**
 * PATCH /api/admin/flags/:id — resolve one flag.
 *
 * `dismiss` closes it alone. `remove` also removes the reported listing, and
 * `suspend` also suspends the reported user, which blocks their sign-in and
 * messaging and hides their listings.
 */
adminRouter.patch("/flags/:id", async (req, res) => {
  const body = req.body ?? {};
  const action = body.action;
  if (!["dismiss", "remove", "suspend"].includes(action) || Object.keys(body).some((key) => key !== "action")) {
    res.status(400).json({ error: "Action must be dismiss, remove or suspend." });
    return;
  }

  // Claim the flag first: the filter on status: "open" means two admins acting
  // at once cannot both apply a side effect to the same report.
  const flag = await Flag.findOneAndUpdate(
    { _id: req.params.id, status: "open" },
    { $set: { status: action === "dismiss" ? "dismissed" : "actioned", resolvedBy: req.userId, resolvedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!flag) {
    res.status(404).json({ error: "Open report not found. It may already have been reviewed." });
    return;
  }

  try {
    if (action === "remove") {
      if (flag.targetType !== "listing") throw new ModerationTargetError("That report is about a user, so there is no listing to remove.");
      const listing = await Listing.findByIdAndUpdate(flag.target, { $set: { status: "removed" } });
      if (!listing) throw new ModerationTargetError("The reported listing no longer exists.");
    }
    if (action === "suspend") {
      // Suspending from a listing report suspends that listing's seller.
      const userId = flag.targetType === "user"
        ? flag.target
        : (await Listing.findById(flag.target).select("seller").lean())?.seller;
      if (!userId) throw new ModerationTargetError("The reported listing no longer exists, so its seller cannot be identified.");
      // Administrators cannot be suspended, matching PATCH /users/:id.
      const user = await User.findOneAndUpdate({ _id: userId, role: "student" }, { $set: { suspended: true } }, { returnDocument: "after" });
      if (!user) throw new ModerationTargetError("Student account not found. Administrator accounts cannot be suspended.");
      await Listing.updateMany({ seller: user._id, status: "active" }, { $set: { status: "removed" } });
      req.app.get("io")?.in(`user:${user.id}`).disconnectSockets(true);
    }
  } catch (cause) {
    // Put the flag back so the queue still shows work that was not carried out.
    await Flag.updateOne({ _id: flag._id }, { $set: { status: "open" }, $unset: { resolvedBy: 1, resolvedAt: 1 } });
    if (cause instanceof ModerationTargetError) {
      res.status(409).json({ error: cause.message });
      return;
    }
    throw cause;
  }

  res.json({ id: flag.id, status: flag.status, resolvedAt: flag.resolvedAt });
});

/** A moderation action that cannot be carried out, reported as 409. */
class ModerationTargetError extends Error {}

adminRouter.put("/rules", async (req, res) => {
  const content = req.body?.content;
  if (typeof content !== "string" || !content.trim() || content.trim().length > RULES_MAX_LENGTH) {
    res.status(400).json({ error: `Rules must contain 1 to ${RULES_MAX_LENGTH} characters.` }); return;
  }
  const rules = await MarketplaceRules.findByIdAndUpdate("marketplace",
    { $set: { content: content.trim(), updatedBy: req.userId } }, { upsert: true, returnDocument: "after", runValidators: true });
  res.json({ content: rules!.content, updatedAt: rules!.updatedAt });
});
