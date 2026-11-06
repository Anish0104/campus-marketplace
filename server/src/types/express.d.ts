import "express";

declare module "express-serve-static-core" {
  interface Request {
    /** Id of the signed-in user, set by requireUser. */
    userId?: string;
    /** Role loaded from the server-side user record by requireUser. */
    userRole?: "student" | "admin";
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}
