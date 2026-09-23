import { useState } from "react";
import { api } from "./types";
interface AuditEntry {
  id: number;
  action: string;
  createdAt: string;
  userId?: string;
  entityId?: string;
}
interface AuditVerification {
  valid: boolean;
  entriesVerified?: number;
  brokenAtIndex?: number;
  reason?: string;
}
function timestamp(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleString()
    : "Timestamp unavailable";
}
export default function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null),
    [verification, setVerification] = useState<AuditVerification | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function refresh() {
    setBusy("Loading audit trail");
    setError("");
    setVerification(null);
    try {
      setEntries(await api<AuditEntry[]>("/audit"));
    } catch (e) {
      setEntries(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  async function verify() {
    setBusy("Verifying audit chain");
    setError("");
    setVerification(null);
    try {
      setVerification(await api<AuditVerification>("/audit/verify"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel padded" aria-label="Audit trail">
      <div className="panel-heading">
        <h3>Audit trail</h3>
        <button
          className="button compact"
          disabled={!!busy}
          onClick={() => void refresh()}
        >
          Refresh audit trail
        </button>
      </div>
      <button
        className="button compact"
        disabled={!!busy}
        onClick={() => void verify()}
      >
        Verify audit chain
      </button>
      {busy && <p role="status">{busy}...</p>}
      {error && <p role="alert">{error}</p>}
      {verification &&
        (verification.valid ? (
          <p role="status">
            Audit chain verified:{" "}
            {verification.entriesVerified ?? "Unavailable"} entries.
          </p>
        ) : (
          <p role="alert">
            Audit chain verification failed.{" "}
            {verification.reason ?? "Integrity check did not pass."}
            {verification.brokenAtIndex !== undefined
              ? ` Entry index: ${verification.brokenAtIndex}.`
              : ""}
          </p>
        ))}
      {entries === null ? (
        <p className="muted">Refresh to read the latest audit entries.</p>
      ) : entries.length === 0 ? (
        <p>No audit entries.</p>
      ) : (
        entries.map((entry) => (
          <div className="audit-row" key={entry.id}>
            <b>{entry.action}</b>
            <small>
              Author: {entry.userId || "Unavailable"} |{" "}
              {timestamp(entry.createdAt)}
            </small>
            {entry.entityId && <small>Entity: {entry.entityId}</small>}
          </div>
        ))
      )}
      <p className="note">
        Verification checks the stored hash chain at request time. It does not
        independently certify the underlying source records.
      </p>
    </section>
  );
}
