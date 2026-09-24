import { useState } from "react";
import { api } from "./types";
import type { AuditVerificationResponse } from "./types";
import { ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";

interface AuditEntry {
  id: number;
  action: string;
  createdAt: string;
  userId?: string;
  entityId?: string;
}

function timestamp(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleString()
    : "Timestamp unavailable";
}

export default function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [verification, setVerification] = useState<AuditVerificationResponse | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);

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
    setBusy("Verifying audit chain... Checking cryptographic ledger hashes...");
    setError("");
    setVerification(null);
    try {
      // Simulate quick check step feedback if needed
      const res = await api<AuditVerificationResponse>("/audit/verify");
      setVerification(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  const entriesCount = verification?.entriesChecked ?? verification?.entriesVerified ?? 0;

  return (
    <section className="panel padded audit-panel" aria-label="Audit trail">
      <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="eyebrow" style={{ display: "block", color: "#64748b", fontSize: "11px", fontWeight: 700 }}>IMMUTABLE EVIDENCE LEDGER</span>
          <h3 style={{ margin: "2px 0 0 0" }}>Audit Trail &amp; Chain of Custody</h3>
        </div>
        <button
          className="button compact"
          disabled={!!busy}
          onClick={() => void refresh()}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshCw size={14} className={busy ? "spin" : ""} />
          Refresh audit trail
        </button>
      </div>

      <div style={{ margin: "16px 0", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          className="button primary"
          disabled={!!busy}
          onClick={() => void verify()}
          aria-label="Verify Chain of Custody - Verify audit chain"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600, maxWidth: "100%", whiteSpace: "normal" }}
        >
          <ShieldCheck size={16} />
          Verify Chain of Custody
        </button>
      </div>

      {busy && (
        <div className="audit-verifying-status" role="status" style={{ padding: "12px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "6px", color: "#38bdf8", margin: "12px 0" }}>
          <p style={{ margin: 0, fontSize: "12.5px" }}>{busy}</p>
        </div>
      )}

      {error && <p role="alert" style={{ color: "#ef4444", padding: "8px", background: "#fef2f2", borderRadius: "4px" }}>{error}</p>}

      {verification && (
        verification.valid ? (
          <div
            className="audit-verification-card valid"
            role="status"
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderLeft: "5px solid #10b981",
              padding: "16px",
              borderRadius: "6px",
              margin: "14px 0",
              color: "#065f46"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={20} color="#059669" />
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, letterSpacing: "0.5px" }}>
                AUDIT CHAIN VALID
              </h4>
            </div>
            <p style={{ margin: "6px 0 10px 0", fontSize: "13px" }}>
              Audit chain verified: <b>{entriesCount} / {entriesCount} entries</b> without modification.
            </p>

            <div style={{ fontSize: "11.5px", color: "#047857", lineHeight: "1.6", background: "#f0fdf4", padding: "8px 12px", borderRadius: "4px" }}>
              <div><b>Genesis Hash:</b> <code>{verification.genesisHash?.slice(0, 16)}...</code></div>
              <div><b>Head Hash:</b> <code>{verification.headHash?.slice(0, 16)}...</code></div>
              <div><b>Verified:</b> {verification.verifiedAt ? timestamp(verification.verifiedAt) : "Just now"}</div>
            </div>

            <button
              className="button compact"
              onClick={() => setShowDetails(!showDetails)}
              style={{ marginTop: "10px", fontSize: "11px", background: "#d1fae5", border: "1px solid #6ee7b7", color: "#065f46" }}
            >
              {showDetails ? "Hide Verification Details" : "View Verification Details"}
            </button>

            {showDetails && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#ffffff", border: "1px solid #a7f3d0", borderRadius: "4px", fontSize: "11px", color: "#1f2937" }}>
                <p style={{ margin: "0 0 6px 0" }}><b>Cryptographic Proof Specifications:</b></p>
                <div><b>Algorithm:</b> SHA-256 with previous-hash chaining</div>
                <div><b>Full Genesis Hash:</b> <code style={{ wordBreak: "break-all" }}>{verification.genesisHash}</code></div>
                <div><b>Full Head Hash:</b> <code style={{ wordBreak: "break-all" }}>{verification.headHash}</code></div>
                <div><b>Ledger Lock:</b> Row-level exclusive lock on audit_chain_lock</div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="audit-verification-card invalid"
            role="alert"
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderLeft: "5px solid #ef4444",
              padding: "16px",
              borderRadius: "6px",
              margin: "14px 0",
              color: "#991b1b"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={20} color="#dc2626" />
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, letterSpacing: "0.5px" }}>
                INTEGRITY VERIFICATION FAILED
              </h4>
            </div>
            <p style={{ margin: "8px 0", fontSize: "13px" }}>
              Audit chain verification failed. Cryptographic hash chain broken. Database records have been modified or deleted outside lawful ledger constraints. {verification.reason ?? "Integrity check did not pass."}
            </p>
            <div style={{ fontSize: "11.5px", background: "#fff1f2", padding: "10px", borderRadius: "4px", border: "1px solid #fecdd3" }}>
              <div><b>First affected entry:</b> #{verification.firstBrokenEntry ?? verification.brokenAtIndex ?? "Unknown"}</div>
              <div><b>Reason:</b> {verification.reason ?? "Broken cryptographic linkage"}</div>
              {verification.brokenAtIndex !== undefined && (
                <div><b>Failure index:</b> Entry {verification.brokenAtIndex}</div>
              )}
            </div>
          </div>
        )
      )}

      {entries === null ? (
        <p className="muted">Refresh to view recent audit trail records.</p>
      ) : entries.length === 0 ? (
        <p>No audit entries in database.</p>
      ) : (
        <div className="audit-entries-list" style={{ maxHeight: "380px", overflowY: "auto", marginTop: "12px" }}>
          {entries.map((entry) => (
            <div className="audit-row" key={entry.id} style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{entry.action}</b>
                <small style={{ color: "#64748b" }}>#{entry.id}</small>
              </div>
              <small style={{ display: "block", color: "#64748b" }}>
                Author: {entry.userId || "Unavailable"} | {timestamp(entry.createdAt)}
              </small>
              {entry.entityId && <small style={{ color: "#0284c7" }}>Entity: {entry.entityId}</small>}
            </div>
          ))}
        </div>
      )}

      <p className="note" style={{ fontSize: "11px", color: "#64748b", marginTop: "14px" }}>
        Verification computes genesis-to-head SHA-256 hash chains at request time. It does not independently certify the underlying source records.
      </p>
    </section>
  );
}
