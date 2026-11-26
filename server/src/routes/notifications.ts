import { Router } from "express";
import { isObjectIdOrHexString } from "mongoose";
import { requireUser } from "../middleware/requireUser";
import { Notification } from "../models/Notification";

export const notificationsRouter = Router();

notificationsRouter.use(requireUser);

notificationsRouter.get("/", async (req, res) => {
  const notifications = await Notification.find({ recipient: req.userId })
    .select("type text link read createdAt")
    .sort({ createdAt: -1, _id: -1 })
    .limit(50)
    .lean();
  res.json(notifications);
});

notificationsRouter.get("/unread-count", async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.userId, read: false });
  res.json({ count });
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  const { id } = req.params;
  if (!isObjectIdOrHexString(id)) {
    res.status(400).json({ error: "Notification id must be valid." });
    return;
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: req.userId },
    { $set: { read: true } },
    { returnDocument: "after" }
  ).select("type text link read createdAt").lean();

  if (!notification) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.json(notification);
});
