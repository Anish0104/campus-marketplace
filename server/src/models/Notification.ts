import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

export const NOTIFICATION_TYPES = ["new_message", "flagged", "removed"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    text: { type: String, trim: true, required: true },
    link: {
      type: String,
      trim: true,
      required: true,
      match: [/^\/(?!\/)[^\\\s]*$/, "Notification link must be an in-app path."],
    },
    read: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

// Support the recipient's newest-first list and unread count.
notificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

export type NotificationDoc = HydratedDocument<InferSchemaType<typeof notificationSchema>>;
export const Notification = model("Notification", notificationSchema);
