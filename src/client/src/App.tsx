import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CalendarResponse, User } from "../../shared/types";
import { api } from "./api";

type Route = {
  name: "login" | "register" | "calendar" | "admin";
  inviteCode?: string;
};

function routeFromPath(): Route {
  const path = window.location.pathname;
  if (path.startsWith("/register/")) {
    return { name: "register", inviteCode: decodeURIComponent(path.replace("/register/", "")) };
  }
  if (path === "/admin") {
    return { name: "admin" };
  }
  if (path === "/login") {
    return { name: "login" };
  }
  return { name: "calendar" };
}

function navigate(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPath());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleRoute = () => setRoute(routeFromPath());
    window.addEventListener("popstate", handleRoute);
    return () => window.removeEventListener("popstate", handleRoute);
  }, []);

  useEffect(() => {
    api
      .me()
      .then(({ user: nextUser }) => setUser(nextUser))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <main className="app-shell">Loading...</main>;
  }

  if (!user && route.name !== "register") {
    return <AuthScreen onLogin={setUser} />;
  }

  if (route.name === "register") {
    return <RegisterScreen inviteCode={route.inviteCode ?? ""} onRegister={setUser} />;
  }

  if (route.name === "admin" && user?.role === "admin") {
    return <AdminScreen user={user} onLogout={() => logout(setUser)} />;
  }

  return <CalendarScreen user={user!} onLogout={() => logout(setUser)} />;
}

async function logout(setUser: (user: User | null) => void) {
  await api.logout();
  setUser(null);
  navigate("/login");
}

function AuthScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.login(email, password);
      onLogin(response.user);
      navigate("/calendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Meetup</h1>
        <form onSubmit={submit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}

function RegisterScreen({ inviteCode, onRegister }: { inviteCode: string; onRegister: (user: User) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.register(inviteCode, name, email, password);
      onRegister(response.user);
      navigate("/calendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Join Meetup</h1>
        <form onSubmit={submit}>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
        </form>
      </section>
    </main>
  );
}

function AppHeader({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => navigate("/calendar")}>Meetup</button>
      <nav>
        <button onClick={() => navigate("/calendar")}>Calendar</button>
        {user.role === "admin" && <button onClick={() => navigate("/admin")}>Admin</button>}
        <button onClick={onLogout}>Sign out</button>
      </nav>
    </header>
  );
}

function CalendarScreen({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState("");
  const [busyDate, setBusyDate] = useState<string | null>(null);

  useEffect(() => {
    api.calendar().then(setCalendar).catch((err) => setError(err instanceof Error ? err.message : "Could not load calendar"));
  }, []);

  const possibleDates = useMemo(
    () => calendar?.months.flatMap((month) => month.days).filter((day) => day.isCurrentMonth && day.allAvailable) ?? [],
    [calendar]
  );

  async function toggle(date: string, available: boolean) {
    setBusyDate(date);
    setError("");
    try {
      setCalendar(await api.setAvailability(date, available));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update availability");
    } finally {
      setBusyDate(null);
    }
  }

  return (
    <main className="app-shell">
      <AppHeader user={user} onLogout={onLogout} />
      <section className="summary">
        <div>
          <h1>Availability</h1>
          <p>{calendar?.participants.length ?? 0} participants</p>
        </div>
        <div className="meetup-count">
          <strong>{possibleDates.length}</strong>
          <span>possible meetup days</span>
        </div>
      </section>
      {error && <p className="error">{error}</p>}
      {!calendar ? (
        <p>Loading calendar...</p>
      ) : (
        <section className="months">
          {calendar.months.map((month) => (
            <article className="month" key={`${month.year}-${month.month}`}>
              <h2>{month.label}</h2>
              <div className="weekday-row">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {month.days.map((day) => {
                  const className = [
                    "day",
                    day.isCurrentMonth ? "" : "muted",
                    day.currentUserAvailable ? "selected" : "",
                    day.allAvailable ? "all-available" : day.availableCount > 0 ? "partial" : "",
                    day.isToday ? "today" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      className={className}
                      key={day.date}
                      onClick={() => toggle(day.date, !day.currentUserAvailable)}
                      disabled={busyDate === day.date}
                      title={day.availableNames.length ? day.availableNames.join(", ") : "No availability yet"}
                    >
                      <span className="date-number">{Number(day.date.slice(8, 10))}</span>
                      <span className="count">
                        {day.availableCount}/{day.participantCount}
                      </span>
                      <span className="names">{day.availableNames.slice(0, 2).join(", ") || "\u00a0"}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function AdminScreen({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.users().then((response) => setUsers(response.users)).catch((err) => setError(err instanceof Error ? err.message : "Could not load users"));
  }, []);

  async function createInvite() {
    setError("");
    try {
      const response = await api.createInvite();
      setInviteUrl(response.invite.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invite");
    }
  }

  return (
    <main className="app-shell">
      <AppHeader user={user} onLogout={onLogout} />
      <section className="summary">
        <div>
          <h1>Admin</h1>
          <p>{users.length} registered users</p>
        </div>
        <button onClick={createInvite}>Create invite</button>
      </section>
      {error && <p className="error">{error}</p>}
      {inviteUrl && (
        <section className="invite-box">
          <label>
            Invite link
            <input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} />
          </label>
        </section>
      )}
      <section className="user-list">
        {users.map((listedUser) => (
          <div className="user-row" key={listedUser.id}>
            <div>
              <strong>{listedUser.name}</strong>
              <span>{listedUser.email}</span>
            </div>
            <span className="badge">{listedUser.role}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
