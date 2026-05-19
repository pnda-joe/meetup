import "dotenv/config";

export type AppConfig = {
  appOrigin: string;
  cookieSecret: string;
  databasePath: string;
  isProduction: boolean;
  port: number;
  timezone: string;
  admin: {
    email: string;
    name: string;
    password: string;
  };
};

export function getConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
    cookieSecret: process.env.COOKIE_SECRET ?? "dev-cookie-secret-change-me",
    databasePath: process.env.DATABASE_PATH ?? "meetup.db",
    isProduction,
    port: Number(process.env.PORT ?? 3000),
    timezone: process.env.APP_TIMEZONE ?? "Europe/Dublin",
    admin: {
      email: process.env.ADMIN_EMAIL ?? "admin@example.com",
      name: process.env.ADMIN_NAME ?? "Admin",
      password: process.env.ADMIN_PASSWORD ?? "change-me-now"
    },
    ...overrides
  };
}
