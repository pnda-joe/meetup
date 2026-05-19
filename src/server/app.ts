import cookieParser from "cookie-parser";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { authMiddleware, clearSessionCookie, hashToken, requireAdmin, requireUser, sessionExpiry, setSessionCookie } from "./auth.js";
import { buildCalendar } from "./calendar.js";
import { createInviteCode, createSessionToken, publicUser, type Db } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  inviteCode: z.string().min(8),
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

const availabilitySchema = z.object({
  available: z.boolean()
});

const avatarSchema = z.object({
  avatarUrl: z.string().max(400_000).nullable()
});

export function createApp(db: Db, config: AppConfig) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(cookieParser(config.cookieSecret));
  app.use(authMiddleware(db));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/me", (req, res) => {
    res.json({ user: req.user ?? null });
  });

  app.patch("/api/me/avatar", requireUser, (req, res) => {
    const parsed = avatarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Avatar image is too large" });
      return;
    }

    if (parsed.data.avatarUrl && !parsed.data.avatarUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "Avatar must be an image" });
      return;
    }

    db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(parsed.data.avatarUrl, req.user!.id);
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as Record<string, unknown>;
    res.json({ user: publicUser(row) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Valid email and password are required" });
      return;
    }

    const row = db
      .prepare("SELECT * FROM users WHERE email = ? AND active = 1")
      .get(parsed.data.email.toLowerCase()) as Record<string, unknown> | undefined;

    if (!row || !(await verifyPassword(parsed.data.password, String(row.password_hash)))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = createSessionToken();
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
      hashToken(token),
      Number(row.id),
      sessionExpiry()
    );
    setSessionCookie(res, config, token);
    res.json({ user: publicUser(row) });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.signedCookies?.meetup_session;
    if (token && typeof token === "string") {
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    }

    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invite code, name, valid email, and 8+ character password are required" });
      return;
    }

    const invite = db
      .prepare("SELECT * FROM invites WHERE code = ? AND used_at IS NULL")
      .get(parsed.data.inviteCode) as Record<string, unknown> | undefined;

    if (!invite) {
      res.status(400).json({ error: "Invite code is invalid or already used" });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const transaction = db.transaction(() => {
      const result = db
        .prepare("INSERT INTO users (email, name, password_hash, role, active) VALUES (?, ?, ?, 'user', 1)")
        .run(email, parsed.data.name, passwordHash);
      db.prepare("UPDATE invites SET used_by_user_id = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        Number(result.lastInsertRowid),
        Number(invite.id)
      );
      return result.lastInsertRowid;
    });

    const userId = Number(transaction());
    const user = publicUser(
      db.prepare("SELECT id, email, name, role, active FROM users WHERE id = ?").get(userId) as Record<string, unknown>
    );
    const token = createSessionToken();
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(hashToken(token), user.id, sessionExpiry());
    setSessionCookie(res, config, token);
    res.status(201).json({ user });
  });

  app.get("/api/calendar", requireUser, (req, res) => {
    res.json(buildCalendar(db, req.user!.id, config.timezone));
  });

  app.put("/api/availability/:date", requireUser, (req, res) => {
    const date = String(req.params.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "Date must use YYYY-MM-DD" });
      return;
    }

    const parsed = availabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Available must be true or false" });
      return;
    }

    if (parsed.data.available) {
      db.prepare(
        `INSERT INTO availability (user_id, date, available, updated_at)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, date) DO UPDATE SET available = 1, updated_at = CURRENT_TIMESTAMP`
      ).run(req.user!.id, date);
    } else {
      db.prepare("DELETE FROM availability WHERE user_id = ? AND date = ?").run(req.user!.id, date);
    }

    res.json(buildCalendar(db, req.user!.id, config.timezone));
  });

  app.get("/api/admin/users", requireAdmin, (_req, res) => {
    const users = db
      .prepare("SELECT id, email, name, role, active, avatar_url AS avatarUrl, created_at FROM users ORDER BY created_at")
      .all();
    res.json({ users });
  });

  app.post("/api/admin/invites", requireAdmin, (req, res) => {
    const code = createInviteCode();
    db.prepare("INSERT INTO invites (code, created_by_user_id) VALUES (?, ?)").run(code, req.user!.id);
    res.status(201).json({
      invite: {
        code,
        url: `${config.appOrigin.replace(/\/$/, "")}/register/${code}`
      }
    });
  });

  if (process.env.NODE_ENV !== "test") {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientPath = path.resolve(dirname, "../client");
    app.use(express.static(clientPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(clientPath, "index.html"));
    });
  }

  return app;
}
