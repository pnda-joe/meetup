import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "./config.js";

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the Vite dev server as the default app origin outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "");
    delete process.env.APP_ORIGIN;

    expect(getConfig().appOrigin).toBe("http://localhost:5173");
  });

  it("uses the backend port as the default app origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "");
    delete process.env.APP_ORIGIN;

    expect(getConfig().appOrigin).toBe("http://localhost:3000");
  });
});
