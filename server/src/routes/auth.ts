import { Router, type Request, type Response } from "express";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import { User } from "../models/User";
import { requireUser } from "../middleware/requireUser";
import { hashPassword, verifyPassword, validPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES } from "../services/password";
import { issueSocketTicket } from "../services/socketTicket";

export const authRouter = Router();

const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 120;
const PASSWORD_MAX_LENGTH = PASSWORD_MAX_BYTES;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RUTGERS_DOMAINS = new Set(["rutgers.edu", "scarletmail.rutgers.edu"]);
let dummyPasswordHash: Promise<string> | undefined;

const registrationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again later." },
});

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again later." },
});

const safeUser = (user: InstanceType<typeof User>) => ({
  id: user.id,
  ...(user.netId ? { netId: user.netId } : {}),
  name: user.name,
  email: user.email,
  role: user.role,
  ...(user.username ? { username: user.username } : {}),
});

function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function regenerateSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

async function establishSession(req: Request, userId: string) {
  await regenerateSession(req);
  req.session.userId = userId;
  await saveSession(req);
}

function normalizedRutgersEmail(value: unknown): { email?: string; error?: string } {
  if (typeof value !== "string" || value.length > EMAIL_MAX_LENGTH) {
    return { error: "Only Rutgers students can register." };
  }
  const email = value.trim().toLowerCase();
  const separator = email.lastIndexOf("@");
  const domain = separator >= 0 ? email.slice(separator + 1) : "";
  if (!RUTGERS_DOMAINS.has(domain)) {
    return { error: "Only Rutgers students can register." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }
  return { email };
}

function getDummyPasswordHash() {
  dummyPasswordHash ??= hashPassword(randomBytes(32).toString("hex"));
  return dummyPasswordHash;
}

authRouter.post("/register", registrationLimit, async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const emailResult = normalizedRutgersEmail(req.body?.email);
  const password = req.body?.password;

  if (emailResult.error) {
    res.status(400).json({ error: emailResult.error });
    return;
  }
  if (!name || name.length > NAME_MAX_LENGTH) {
    res.status(400).json({ error: `Enter your name using 1 to ${NAME_MAX_LENGTH} characters.` });
    return;
  }
  if (!validPassword(password)) {
    res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters and no more than ${PASSWORD_MAX_LENGTH} bytes.` });
    return;
  }

  const passwordHash = await hashPassword(password);
  let user: InstanceType<typeof User>;
  try {
    user = await User.create({
      name,
      email: emailResult.email,
      passwordHash,
      role: "student",
      suspended: false,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      res.status(409).json({ error: "An account with this email already exists. Please sign in." });
      return;
    }
    throw error;
  }

  await establishSession(req, user.id);
  res.status(201).json(safeUser(user));
});

// Both entry points use identical credential verification and session rotation.
function login(admin: boolean) {
  return async (req: Request, res: Response) => {
    const emailResult = normalizedRutgersEmail(req.body?.email);
    const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
    const password = req.body?.password;
    const invalid = admin ? !username || username.length > 32 : !!emailResult.error;
    const error = admin ? "Username or password is incorrect." : "Email or password is incorrect.";
    if (invalid || typeof password !== "string" || Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
      res.status(401).json({ error });
      return;
    }
    const user = await User.findOne(admin ? { username, role: "admin" } : { email: emailResult.email, role: "student" })
      .select("+passwordHash username netId name email role suspended");
    const matches = await verifyPassword(password, user?.passwordHash ?? await getDummyPasswordHash());
    if (!user?.passwordHash || !matches) {
      res.status(401).json({ error });
      return;
    }
    if (user.suspended) {
      res.status(403).json({ error: "This account is suspended. Contact an administrator." });
      return;
    }
    await establishSession(req, user.id);
    res.json(safeUser(user));
  };
}

authRouter.post("/login", loginLimit, login(false));
authRouter.post("/admin/login", loginLimit, login(true));

authRouter.post("/socket-ticket", requireUser, (req, res) => {
  res.json({ ticket: issueSocketTicket(req.userId!) });
});

authRouter.get("/me", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  const user = await User.findById(userId).select("username netId name email role suspended");
  if (!user || user.suspended) {
    req.session.destroy(() => {});
    res.status(user?.suspended ? 403 : 401).json({
      error: user?.suspended ? "This account is suspended. Contact an administrator." : "Your session has expired. Please sign in again.",
    });
    return;
  }
  res.json(safeUser(user));
});

authRouter.post("/logout", async (req, res) => {
  const userId = req.session.userId;
  if (userId) {
    const io = req.app.get("io");
    io?.in(`user:${userId}`).disconnectSockets(true);
  }
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
  res.clearCookie("cm.sid", { path: "/" });
  res.status(204).end();
});
