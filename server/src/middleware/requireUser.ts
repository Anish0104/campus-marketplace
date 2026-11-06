import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { User } from "../models/User";

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "test") {
    const testUserId = req.header("x-user-id");
    if (testUserId && isValidObjectId(testUserId)) {
      req.userId = testUserId;
      req.userRole = req.header("x-test-user-role") === "admin" ? "admin" : "student";
      next();
      return;
    }
  }

  const userId = req.session.userId;
  if (!userId || !isValidObjectId(userId)) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  const user = await User.findById(userId).select("role suspended");
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
    return;
  }
  if (user.suspended) {
    req.session.destroy(() => {});
    res.status(403).json({ error: "This account is suspended. Contact an administrator." });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Administrator access is required." });
    return;
  }
  next();
}
