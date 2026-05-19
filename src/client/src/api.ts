import type { CalendarResponse, User } from "../../shared/types";

type ApiError = {
  error?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error ?? "Something went wrong");
  }

  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<{ user: User | null }>("/api/me"),
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  register: (inviteCode: string, name: string, email: string, password: string) =>
    request<{ user: User }>("/api/register", {
      method: "POST",
      body: JSON.stringify({ inviteCode, name, email, password })
    }),
  calendar: () => request<CalendarResponse>("/api/calendar"),
  setAvailability: (date: string, available: boolean) =>
    request<CalendarResponse>(`/api/availability/${date}`, {
      method: "PUT",
      body: JSON.stringify({ available })
    }),
  users: () => request<{ users: User[] }>("/api/admin/users"),
  createInvite: () => request<{ invite: { code: string; url: string } }>("/api/admin/invites", { method: "POST" })
};
