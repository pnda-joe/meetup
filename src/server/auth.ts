import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { Db } from "./db.js";
import { publicUser } from "./db.js";
import type { AppConfig } from "./config.js";
import type { User } from "../shared/types.js";

const SESSION_COOKIE = "meetup_session";
const SESSION_DAYS = 30;

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function setSessionCookie(res: Response, config: AppConfig, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    signed: true
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE);
}

export function sessionExpiry(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  return expires.toISOString();
}

export function authMiddleware(db: Db) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.signedCookies?.[SESSION_COOKIE];
    if (!token || typeof token !== "string") {
      next();
      return;
    }

    const row = db
      .prepare(
        `SELECT users.id, users.email, users.name, users.role, users.active
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP AND users.active = 1`
      )
      .get(hashToken(token)) as Record<string, unknown> | undefined;

    if (row) {
      req.user = publicUser(row);
    }

    next();
  };
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

export function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
