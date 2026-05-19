import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const calendarResponse = {
  participants: [
    { id: 1, name: "Admin", email: "admin@example.com" },
    { id: 2, name: "Guest", email: "guest@example.com" }
  ],
  months: [
    {
      label: "May 2026",
      year: 2026,
      month: 5,
      days: Array.from({ length: 42 }, (_, index) => ({
        date: `2026-05-${String(index + 1).padStart(2, "0")}`,
        isToday: index === 17,
        isCurrentMonth: index < 31,
        availableUserIds: index === 19 ? [1, 2] : [],
        availableNames: index === 19 ? ["Admin", "Guest"] : [],
        availableCount: index === 19 ? 2 : 0,
        participantCount: 2,
        allAvailable: index === 19,
        currentUserAvailable: index === 19
      }))
    }
  ]
};

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/calendar");
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path === "/api/me") {
          return Promise.resolve(Response.json({ user: { id: 1, name: "Admin", email: "admin@example.com", role: "admin", active: true } }));
        }
        if (path === "/api/calendar") {
          return Promise.resolve(Response.json(calendarResponse));
        }
        return Promise.resolve(Response.json({ ok: true }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the rolling calendar and fully available day count", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("May 2026")).toBeInTheDocument());
    expect(screen.getByText("2 participants")).toBeInTheDocument();
    expect(screen.getByText("possible meetup days")).toBeInTheDocument();
    expect(document.querySelector(".meetup-count strong")).toHaveTextContent("1");
  });
});
