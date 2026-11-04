import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// One conversation per listing per buyer.
const conversationSchema = new Schema(
  {
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    // Copy of the listing title so the inbox loads without a second query.
    listingTitle: { type: String, required: true, trim: true, maxlength: 120 },
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastMessage: {
      body: { type: String },
      sender: { type: Schema.Types.ObjectId, ref: "User" },
      sentAt: { type: Date },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ listing: 1, buyer: 1 }, { unique: true });
conversationSchema.index({ buyer: 1, updatedAt: -1 });
conversationSchema.index({ seller: 1, updatedAt: -1 });

export type ConversationDoc = HydratedDocument<InferSchemaType<typeof conversationSchema>>;

export const Conversation = model("Conversation", conversationSchema);

export function isParticipant(conversation: ConversationDoc, userId: string) {
  return conversation.buyer.equals(userId) || conversation.seller.equals(userId);
}

export function otherParticipant(conversation: ConversationDoc, userId: string) {
  return conversation.buyer.equals(userId) ? conversation.seller : conversation.buyer;
}
