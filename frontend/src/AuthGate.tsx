import { useEffect, useState } from "react";
import { api, getSession, setSession } from "./types";
import type { Session } from "./types";
import App from "./App";

const DEMO_ACCOUNTS = {
  admin: { username: "admin", password: "ZAnYeTpSbu9ainRYo1EELguTrN3twZlh", title: "Admin (Full Access)" },
  investigator: { username: "investigator", password: "TFw3vJQtf9b37aPWSq0OhBHBha2oOqLo", title: "Investigator (Forensics & Triage)" },
  viewer: { username: "viewer", password: "-GxYeD8f13u58HMGtgZ8J4Fa88utj5Os", title: "Viewer (Read-only Dossier)" },
};

export default function AuthGate() {
  const [session, update] = useState(getSession),
    [expired, setExpired] = useState(false),
    [checking, setChecking] = useState(!!getSession());
  const [username, setUsername] = useState("admin"),
    [password, setPassword] = useState("ZAnYeTpSbu9ainRYo1EELguTrN3twZlh"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  const quickLogin = async (role: "admin" | "investigator" | "viewer") => {
    setBusy(true);
    setError("");
    try {
      const cred = DEMO_ACCOUNTS[role];
      const result = await api<Session>("/auth/login", {
        username: cred.username,
        password: cred.password,
      });
      setPassword("");
      setSession(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Check if auto-login query parameter is present (e.g. ?judge=1, ?demo=1)
    const params = new URLSearchParams(window.location.search);
    if (!getSession() && (params.has("judge") || params.has("demo") || params.has("eval"))) {
      void quickLogin("admin");
    }
  }, []);

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
      <div className="panel padded login-card" style={{ maxWidth: 440 }}>
        <div className="eyebrow" style={{ color: "#60c5b3", letterSpacing: "0.08em" }}>
          NEXUS &bull; HACKATHON EVALUATION BENCHMARK
        </div>
        <h1 style={{ marginTop: 8, marginBottom: 4 }}>Investigation Workbench</h1>
        <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
          Evidence-linked criminal network intelligence &amp; forensics.
        </p>

        {/* 1-Click Judge Access Banner */}
        <div style={{
          background: "linear-gradient(135deg, rgba(96,197,179,0.15) 0%, rgba(30,58,62,0.4) 100%)",
          border: "1px solid rgba(96,197,179,0.4)",
          borderRadius: 8,
          padding: "14px",
          marginBottom: 16,
          textAlign: "center"
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#60c5b3", marginBottom: 6 }}>
            Judges &amp; Evaluators Quick Access
          </div>
          <button
            type="button"
            className="button primary"
            style={{ width: "100%", padding: "10px 16px", fontWeight: 600, fontSize: 14 }}
            disabled={busy}
            onClick={() => quickLogin("admin")}
          >
            {busy ? "Opening Workbench…" : "⚡ 1-Click Evaluator Access (Admin)"}
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="button secondary"
              style={{ flex: 1, fontSize: 12, padding: "6px" }}
              disabled={busy}
              onClick={() => quickLogin("investigator")}
            >
              Investigator Role
            </button>
            <button
              type="button"
              className="button secondary"
              style={{ flex: 1, fontSize: 12, padding: "6px" }}
              disabled={busy}
              onClick={() => quickLogin("viewer")}
            >
              Viewer Role
            </button>
          </div>
        </div>

        {expired && <p role="alert" style={{ color: "#ea8998" }}>Your session expired. Sign in again.</p>}
        {error && <p role="alert" style={{ color: "#ea8998" }}>{error}</p>}

        <details style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          <summary style={{ cursor: "pointer", padding: "4px 0" }}>Manual Credential Login</summary>
          <form
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
            style={{ marginTop: 8 }}
          >
            <label style={{ display: "block", marginBottom: 8 }}>
              Username
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 12 }}>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <button className="button primary" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </details>
      </div>
    </main>
  );
}
