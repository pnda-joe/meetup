import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { CalendarDay, CalendarResponse, User } from "../../shared/types";
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

const fullDateFormatter = new Intl.DateTimeFormat("en-IE", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});

function formatDate(date: string): string {
  return fullDateFormatter.format(new Date(`${date}T12:00:00`));
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
    return <AdminScreen user={user} onUserChange={setUser} onLogout={() => logout(setUser)} />;
  }

  return <CalendarScreen user={user!} onUserChange={setUser} onLogout={() => logout(setUser)} />;
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

async function imageFileToAvatarUrl(file: File): Promise<string> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Could not read image"));
      nextImage.src = imageUrl;
    });
    const size = 256;
    const scale = Math.min(size / image.width, size / image.height, 1);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not prepare image");
    }
    context.fillStyle = "#f5f2ea";
    context.fillRect(0, 0, size, size);
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function Avatar({ user, size = "medium" }: { user: Pick<User, "name" | "avatarUrl">; size?: "small" | "medium" | "large" }) {
  return user.avatarUrl ? (
    <img className={`avatar ${size}`} src={user.avatarUrl} alt="" />
  ) : (
    <span className={`avatar avatar-initial ${size}`}>{user.name.trim().slice(0, 1).toUpperCase()}</span>
  );
}

function ProfileControl({ user, onUserChange }: { user: User; onUserChange: (user: User) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function saveFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    try {
      const avatarUrl = await imageFileToAvatarUrl(file);
      const response = await api.saveAvatar(avatarUrl);
      onUserChange(response.user);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function removeAvatar() {
    setBusy(true);
    try {
      const response = await api.saveAvatar(null);
      onUserChange(response.user);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-control">
      <button className="avatar-button" onClick={() => inputRef.current?.click()} disabled={busy} title="Change profile picture">
        <Avatar user={user} />
      </button>
      <input ref={inputRef} className="file-input" type="file" accept="image/*" onChange={saveFile} />
      <span>{user.name}</span>
      {user.avatarUrl && (
        <button className="text-button" onClick={removeAvatar} disabled={busy}>
          Remove photo
        </button>
      )}
    </div>
  );
}

function AppHeader({ user, onUserChange, onLogout }: { user: User; onUserChange: (user: User) => void; onLogout: () => void }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => navigate("/calendar")}>Meetup</button>
      <nav>
        <ProfileControl user={user} onUserChange={onUserChange} />
        <button onClick={() => navigate("/calendar")}>Calendar</button>
        {user.role === "admin" && <button onClick={() => navigate("/admin")}>Admin</button>}
        <button onClick={onLogout}>Sign out</button>
      </nav>
    </header>
  );
}

function CalendarScreen({ user, onUserChange, onLogout }: { user: User; onUserChange: (user: User) => void; onLogout: () => void }) {
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState("");
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<CalendarDay | null>(null);
  const [meetupLocation, setMeetupLocation] = useState("");
  const [meetupTime, setMeetupTime] = useState("");
  const [meetupNote, setMeetupNote] = useState("");

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

  function saveUser(nextUser: User) {
    onUserChange(nextUser);
    setCalendar((current) =>
      current
        ? {
            ...current,
            participants: current.participants.map((participant) =>
              participant.id === nextUser.id ? { ...participant, avatarUrl: nextUser.avatarUrl } : participant
            )
          }
        : current
    );
  }

  function sendMeetupEmail(event: FormEvent) {
    event.preventDefault();
    if (!selectedDate || !calendar) {
      return;
    }

    const recipients = calendar.participants.map((participant) => participant.email).join(",");
    const subject = `Meetup on ${formatDate(selectedDate.date)}`;
    const body = [
      `Hi everyone,`,
      ``,
      `The group is available for a meetup on ${formatDate(selectedDate.date)}.`,
      meetupTime ? `Time: ${meetupTime}` : "",
      meetupLocation ? `Location: ${meetupLocation}` : "",
      meetupNote ? `Details: ${meetupNote}` : "",
      ``,
      `See you there.`
    ]
      .filter((line, index, lines) => line || lines[index - 1])
      .join("\n");

    window.location.href = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <main className="app-shell">
      <AppHeader user={user} onUserChange={saveUser} onLogout={onLogout} />
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
        <section className="calendar-layout">
          <div className="months">
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
          </div>
          <aside className="meetup-sidebar">
            <h2>Possible Days</h2>
            {possibleDates.length ? (
              <div className="possible-date-list">
                {possibleDates.map((day) => (
                  <button className="possible-date" key={day.date} onClick={() => setSelectedDate(day)}>
                    <span>{formatDate(day.date)}</span>
                    <small>Email group</small>
                  </button>
                ))}
              </div>
            ) : (
              <p>No full-group dates yet.</p>
            )}
            <div className="participant-strip">
              {calendar.participants.map((participant) => (
                <Avatar key={participant.id} user={{ name: participant.name, avatarUrl: participant.avatarUrl }} size="small" />
              ))}
            </div>
          </aside>
        </section>
      )}
      {selectedDate && calendar && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedDate(null)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="meetup-email-title" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2 id="meetup-email-title">Email Meetup</h2>
                <p>{formatDate(selectedDate.date)}</p>
              </div>
              <button className="text-button" onClick={() => setSelectedDate(null)}>
                Close
              </button>
            </header>
            <form className="meetup-form" onSubmit={sendMeetupEmail}>
              <label>
                Location
                <input value={meetupLocation} onChange={(event) => setMeetupLocation(event.target.value)} placeholder="Cafe, park, address..." />
              </label>
              <label>
                Time
                <input value={meetupTime} onChange={(event) => setMeetupTime(event.target.value)} placeholder="7:30 PM" />
              </label>
              <label>
                Note
                <textarea value={meetupNote} onChange={(event) => setMeetupNote(event.target.value)} placeholder="What should everyone know?" rows={5} />
              </label>
              <div className="email-recipients">
                {calendar.participants.map((participant) => (
                  <span key={participant.id}>
                    <Avatar user={{ name: participant.name, avatarUrl: participant.avatarUrl }} size="small" />
                    {participant.name}
                  </span>
                ))}
              </div>
              <button>Open email</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function AdminScreen({ user, onUserChange, onLogout }: { user: User; onUserChange: (user: User) => void; onLogout: () => void }) {
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
      <AppHeader user={user} onUserChange={onUserChange} onLogout={onLogout} />
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
              <strong>
                <Avatar user={listedUser} size="small" />
                {listedUser.name}
              </strong>
              <span>{listedUser.email}</span>
            </div>
            <span className="badge">{listedUser.role}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
