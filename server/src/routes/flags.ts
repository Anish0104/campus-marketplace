import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireUser } from "../middleware/requireUser";
import { Flag, FLAG_REASONS, FLAG_TARGET_TYPES, type FlagReason, type FlagTargetType, FLAG_LIMITS } from "../models/Flag";
import { Listing } from "../models/Listing";
import { User } from "../models/User";

export const flagsRouter = Router();

/**
 * POST /api/flags — report a listing or a user.
 *
 * Any signed-in student may report. The reporter is always taken from the
 * session, never from the body, so nobody can file a report as someone else.
 */
flagsRouter.post("/", requireUser, async (req, res) => {
  const { targetType, target, reason, note = "" } = req.body ?? {};

  if (!FLAG_TARGET_TYPES.includes(targetType)) {
    res.status(400).json({ error: "Choose whether you are reporting a listing or a user." });
    return;
  }
  if (typeof target !== "string" || !isValidObjectId(target)) {
    res.status(400).json({ error: "Invalid identifier." });
    return;
  }
  if (!FLAG_REASONS.includes(reason)) {
    res.status(400).json({ error: "Choose a reason for the report." });
    return;
  }
  if (typeof note !== "string" || note.length > FLAG_LIMITS.note) {
    res.status(400).json({ error: `Add an optional note of at most ${FLAG_LIMITS.note} characters.` });
    return;
  }

  // Reporting yourself is never useful, and reporting a missing item would
  // leave an unworkable row in the queue.
  if (targetType === "user" && target === req.userId) {
    res.status(400).json({ error: "You cannot report your own account." });
    return;
  }
  const exists = targetType === "listing"
    ? await Listing.exists({ _id: target })
    : await User.exists({ _id: target });
  if (!exists) {
    res.status(404).json({ error: targetType === "listing" ? "Listing not found." : "User not found." });
    return;
  }
  if (targetType === "listing" && await Listing.exists({ _id: target, seller: req.userId })) {
    res.status(400).json({ error: "You cannot report your own listing." });
    return;
  }

  try {
    const flag = await Flag.create({
      targetType: targetType as FlagTargetType,
      target,
      reporter: req.userId!,
      reason: reason as FlagReason,
      note: note.trim(),
    });
    res.status(201).json({ id: flag.id, status: flag.status, createdAt: flag.createdAt });
  } catch (cause) {
    // The unique index on (targetType, target, reporter) is what stops the same
    // user reporting the same item twice. Report it as a conflict rather than a
    // server error, and do not reveal whether others have reported it.
    if ((cause as { code?: number }).code === 11000) {
      res.status(409).json({ error: "You have already reported this. An administrator will review it." });
      return;
    }
    throw cause;
  }
});
