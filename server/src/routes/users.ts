import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireUser } from "../middleware/requireUser";
import { Listing } from "../models/Listing";
import { User } from "../models/User";

/**
 * Public profiles (Santanu). GET /api/users/:id returns what any signed-in
 * student may see about another student: name, NetID, member since, and their
 * active listings. Email, role, suspension state and password data are never
 * returned, because the response is built field by field instead of sending
 * the whole User document.
 */
export const usersRouter = Router();
usersRouter.use(requireUser);

// Same fields the feed returns, so ListingCard can render them. No description.
const PROFILE_LISTING_FIELDS = "title price category condition photos seller status createdAt updatedAt";

usersRouter.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "User id must be a valid MongoDB ObjectId." });
    return;
  }
  const user = await User.findById(req.params.id).select("name netId createdAt suspended").lean();
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  // A suspended user's listings are hidden (moderation). Their profile still loads.
  const listings = user.suspended
    ? []
    : await Listing.find({ seller: user._id, status: "active" })
        .select(PROFILE_LISTING_FIELDS)
        .sort({ createdAt: -1 })
        .lean();
  res.json({
    id: String(user._id),
    name: user.name,
    netId: user.netId ?? null,
    memberSince: user.createdAt,
    listings,
  });
});
