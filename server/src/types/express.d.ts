import "express";

declare module "express-serve-static-core" {
  interface Request {
    /** Id of the signed-in user, set by requireUser. */
    userId?: string;
  }
}
