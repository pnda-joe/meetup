import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { createInviteCode, openDatabase, seedAdmin, type Db } from "./db.js";

async function setup() {
  const config = getConfig({
    databasePath: ":memory:",
    appOrigin: "http://localhost:3000",
    cookieSecret: "test-secret",
    timezone: "Europe/Dublin",
    admin: {
      email: "admin@example.com",
      name: "Admin",
      password: "password123"
    }
  });
  const db = openDatabase(":memory:");
  await seedAdmin(db, config);
  return { app: createApp(db, config), db };
}

describe("meetup api", () => {
  let app: ReturnType<typeof createApp>;
  let db: Db;

  beforeEach(async () => {
    const created = await setup();
    app = created.app;
    db = created.db;
  });

  afterEach(() => {
    db.close();
  });

  it("logs in and out with a session cookie", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
    const me = await agent.get("/api/me").expect(200);
    expect(me.body.user.email).toBe("admin@example.com");

    await agent.post("/api/auth/logout").expect(200);
    const afterLogout = await agent.get("/api/me").expect(200);
    expect(afterLogout.body.user).toBeNull();
  });

  it("lets an admin create an invite and a user register with it", async () => {
    const admin = request.agent(app);
    await admin.post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);

    const inviteResponse = await admin.post("/api/admin/invites").expect(201);
    expect(inviteResponse.body.invite.url).toContain("/register/");

    const guest = request.agent(app);
    const registered = await guest
      .post("/api/register")
      .send({
        inviteCode: inviteResponse.body.invite.code,
        name: "Guest User",
        email: "guest@example.com",
        password: "password123"
      })
      .expect(201);

    expect(registered.body.user.email).toBe("guest@example.com");
    await guest.get("/api/calendar").expect(200);
  });

  it("prevents non-admin users from creating invites", async () => {
    const code = createInviteCode();
    db.prepare("INSERT INTO invites (code, created_by_user_id) VALUES (?, 1)").run(code);

    const guest = request.agent(app);
    await guest
      .post("/api/register")
      .send({ inviteCode: code, name: "Guest", email: "guest@example.com", password: "password123" })
      .expect(201);

    await guest.post("/api/admin/invites").expect(403);
  });

  it("toggles availability and marks dates fully available only when everyone can attend", async () => {
    const code = createInviteCode();
    db.prepare("INSERT INTO invites (code, created_by_user_id) VALUES (?, 1)").run(code);

    const admin = request.agent(app);
    const guest = request.agent(app);
    await admin.post("/api/auth/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
    await guest
      .post("/api/register")
      .send({ inviteCode: code, name: "Guest", email: "guest@example.com", password: "password123" })
      .expect(201);

    const date = "2026-05-20";
    const partial = await admin.put(`/api/availability/${date}`).send({ available: true }).expect(200);
    const partialDay = partial.body.months.flatMap((month: { days: { date: string }[] }) => month.days).find((day: { date: string }) => day.date === date);
    expect(partialDay.availableCount).toBe(1);
    expect(partialDay.allAvailable).toBe(false);

    const full = await guest.put(`/api/availability/${date}`).send({ available: true }).expect(200);
    const fullDay = full.body.months.flatMap((month: { days: { date: string }[] }) => month.days).find((day: { date: string }) => day.date === date);
    expect(fullDay.availableCount).toBe(2);
    expect(fullDay.allAvailable).toBe(true);
  });
});
