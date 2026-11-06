import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isValidObjectId } from "mongoose";

type TicketPayload = { userId: string; expiresAt: number; nonce: string };
const consumed = new Map<string, number>();

function secret() {
  return process.env.SESSION_SECRET ?? "local-development-session-secret-change-me";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueSocketTicket(userId: string) {
  const payload: TicketPayload = {
    userId,
    expiresAt: Date.now() + 30_000,
    nonce: randomBytes(18).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function consumeSocketTicket(ticket: unknown): string | null {
  if (typeof ticket !== "string") return null;
  const [encoded, suppliedSignature, extra] = ticket.split(".");
  if (!encoded || !suppliedSignature || extra !== undefined) return null;

  const expected = Buffer.from(signature(encoded));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<TicketPayload>;
    if (
      typeof payload.userId !== "string" ||
      !isValidObjectId(payload.userId) ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now() ||
      typeof payload.nonce !== "string"
    ) return null;

    for (const [nonce, expiration] of consumed) {
      if (expiration <= Date.now()) consumed.delete(nonce);
    }
    if (consumed.has(payload.nonce)) return null;
    consumed.set(payload.nonce, payload.expiresAt);
    return payload.userId;
  } catch {
    return null;
  }
}
