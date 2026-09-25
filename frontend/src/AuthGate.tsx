import { useEffect, useState } from "react";
import { api, getSession, setSession } from "./types";
import type { Session } from "./types";
import App from "./App";
export default function AuthGate() {
  const [session, update] = useState(getSession),
    [expired, setExpired] = useState(false),
    [checking, setChecking] = useState(!!getSession());
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const onSession = (event: Event) => {
      update(getSession());
      setExpired(!!(event as CustomEvent).detail?.expired);
    };
    window.addEventListener("nexus-session", onSession);
    return () => window.removeEventListener("nexus-session", onSession);
  }, []);
  useEffect(() => {
    const refreshToken = getSession()?.token;
    if (!refreshToken) return;
    void api<{ username: string; role: Session["role"] }>("/auth/me")
      .then((identity) => {
        const current = getSession();
        if (current?.token === refreshToken) setSession({ ...current, ...identity });
      })
      .catch((e) => { if (getSession()?.token === refreshToken) setError(String(e)); })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (!session) return;
    const end =
      typeof session.expiresAt === "number"
        ? Number(session.expiresAt) * 1000
        : Date.parse(session.expiresAt);
    if (!Number.isFinite(end)) return;
    const timer = setTimeout(
      () => setSession(null, true),
      Math.max(0, end - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);
  if (checking)
    return (
      <main className="login-screen">
        <b>PROTOTYPE &mdash; SYNTHETIC DATA</b>
        <p role="status">Checking session…</p>
      </main>
    );
  if (session) return <App key={session.username} session={session} />;
  return (
    <main className="login-screen">
      <form
        className="panel padded login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await api<Session>("/auth/login", {
              username,
              password,
            });
            setPassword("");
            setSession(result);
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="eyebrow">PROTOTYPE &mdash; SYNTHETIC DATA</div>
        <h1>Sign in to NEXUS</h1>
        <p>Use your configured prototype account.</p>
        {expired && <p role="alert">Your session expired. Sign in again.</p>}
        {error && <p role="alert">{error}</p>}
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
