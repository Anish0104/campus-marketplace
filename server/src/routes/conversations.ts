import { Router } from "express";
import { isValidObjectId } from "mongoose";
import type { Server } from "socket.io";
import { requireUser } from "../middleware/requireUser";
import { Conversation, isParticipant, otherParticipant, type ConversationDoc } from "../models/Conversation";
import { Listing } from "../models/Listing";
import { User } from "../models/User";
import { Message, MESSAGE_MAX_LENGTH } from "../models/Message";
import { isSuspended } from "../services/suspension";

export const conversationsRouter = Router();

/** Adds buyerName and sellerName so the inbox can show who each chat is with. */
async function withNames(conversations: ConversationDoc[]) {
  const ids = [...new Set(conversations.flatMap((c) => [String(c.buyer), String(c.seller)]))];
  const users = await User.find({ _id: { $in: ids } }).select("name").lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  return conversations.map((c) => ({
    ...c.toJSON(),
    buyerName: names.get(String(c.buyer)) ?? "Rutgers student",
    sellerName: names.get(String(c.seller)) ?? "Rutgers student",
  }));
}

conversationsRouter.use(requireUser);

// GET /api/conversations: the signed-in user's inbox, most recent first.
conversationsRouter.get("/", async (req, res) => {
  const conversations = await Conversation.find({
    $or: [{ buyer: req.userId }, { seller: req.userId }],
  })
    .sort({ updatedAt: -1 })
    .limit(100);
  res.json(await withNames(conversations));
});

// POST /api/conversations: start (or reopen) a conversation about a listing.
// Body: { listingId }. The seller and title come from the listing itself,
// never from the request, so nobody can open a chat in someone else's name.
conversationsRouter.post("/", async (req, res) => {
  const { listingId } = req.body ?? {};
  const buyerId = req.userId!;

  if (!isValidObjectId(listingId)) {
    res.status(400).json({ error: "listingId must be a valid id." });
    return;
  }

  const listing = await Listing.findById(listingId).select("seller title status");
  if (!listing) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  if (listing.seller.equals(buyerId)) {
    res.status(400).json({ error: "You can't message yourself about your own listing." });
    return;
  }

  const existing = await Conversation.findOne({ listing: listing._id, buyer: buyerId });
  if (existing) {
    res.status(200).json((await withNames([existing]))[0]);
    return;
  }

  if (listing.status !== "active") {
    res.status(400).json({ error: "This listing is no longer available." });
    return;
  }
  if (await isSuspended(listing.seller)) {
    res.status(403).json({ error: "This user's account is suspended." });
    return;
  }

  const conversation = await Conversation.create({
    listing: listing._id,
    listingTitle: listing.title.slice(0, 120),
    buyer: buyerId,
    seller: listing.seller,
  });
  res.status(201).json((await withNames([conversation]))[0]);
});

// Loads a conversation the signed-in user takes part in, or sends 404.
async function loadOwnConversation(id: string, userId: string) {
  if (!isValidObjectId(id)) return null;
  const conversation = await Conversation.findById(id);
  if (!conversation || !isParticipant(conversation, userId)) return null;
  return conversation;
}

// GET /api/conversations/:id/messages: the latest 100 messages, oldest first.
conversationsRouter.get("/:id/messages", async (req, res) => {
  const conversation = await loadOwnConversation(req.params.id, req.userId!);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const latest = await Message.find({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(latest.reverse());
});

// POST /api/conversations/:id/messages: send a message. Body: { body }
conversationsRouter.post("/:id/messages", async (req, res) => {
  const senderId = req.userId!;
  const conversation = await loadOwnConversation(req.params.id, senderId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }

  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body) {
    res.status(400).json({ error: "Message can't be empty." });
    return;
  }
  if (body.length > MESSAGE_MAX_LENGTH) {
    res.status(400).json({ error: `Messages can be up to ${MESSAGE_MAX_LENGTH} characters.` });
    return;
  }

  const recipientId = otherParticipant(conversation, senderId);
  if (await isSuspended(senderId)) {
    res.status(403).json({ error: "Your account is suspended, so you can't send messages." });
    return;
  }
  if (await isSuspended(recipientId)) {
    res.status(403).json({ error: "This user's account is suspended." });
    return;
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    body,
  });

  conversation.lastMessage = { body, sender: message.sender, sentAt: message.createdAt };
  await conversation.save();

  // Push the message to both people in real time.
  const io: Server | undefined = req.app.get("io");
  io?.to(`user:${senderId}`)
    .to(`user:${recipientId}`)
    .emit("message:new", { message, conversation: (await withNames([conversation]))[0] });

  // TODO (Anand): notify(recipientId, "new_message", { conversationId: conversation.id })

  res.status(201).json(message);
});
