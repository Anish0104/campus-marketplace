import { Schema, model } from "mongoose";

export const MESSAGE_MAX_LENGTH = 1000;

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: MESSAGE_MAX_LENGTH },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export const Message = model("Message", messageSchema);
