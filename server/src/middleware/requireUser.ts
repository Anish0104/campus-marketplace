import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";

/**
 * TEMPORARY until sign-in lands (Krisha).
 * The client sends the signed-in user's id in the `x-user-id` header.
 * When real sessions exist, replace the body of this function so it reads
 * the session instead. Every route only depends on `req.userId`, so nothing
 * else has to change.
 */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.header("x-user-id");
  if (!userId || !isValidObjectId(userId)) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  req.userId = userId;
  next();
}
