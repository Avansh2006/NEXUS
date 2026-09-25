import { useEffect, useState } from "react";
import { api, download } from "./types";
import type { Entity, EvidenceSupport } from "./types";
export type Note = {
  id: string;
  entityId: string;
  text: string;
  author: string;
  createdAt: string;
};
export type Triage = {
  alertId: string;
  status: string;
  version: number;
  author: string;
  updatedAt: string;
};
export type Workflow = { notes: Note[]; watchlist: string[]; triage: Triage[] };
export const emptyWorkflow: Workflow = { notes: [], watchlist: [], triage: [] };
export function SupportBadge({ support }: { support?: EvidenceSupport }) {
  return (
    <details className="support-badge">
      <summary>Evidence support: {support?.level ?? "Unassessed"}</summary>
      {support ? (
        <>
          <p>{support.explanation}</p>
          <p>
            {support.recordCount} independent records ·{" "}
            {support.sourceKindCount} source kinds · minimum extraction
            confidence {(support.minimumExtractionConfidence * 100).toFixed(0)}%
          </p>
          <p>
            Credibility:{" "}
            {support.lowCredibility
              ? "Low"
              : support.credibilityAssessed
                ? "Assessed"
                : "Unassessed"}
          </p>
        </>
      ) : (
        <p>Support has not been assessed.</p>
      )}
      <small>Evidence support is not a probability of truth.</small>
    </details>
  );
}
export function EntityWorkflow({
  entity,
  workflow,
  canEdit,
  onRefresh,
}: {
  entity: Entity;
  workflow: Workflow;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notes, setNotes] = useState<Note[]>([]),
    [loadingNotes, setLoadingNotes] = useState(true);
  useEffect(() => { setText(""); }, [entity.id]);
  useEffect(() => {
    let current = true;
    setError("");
    setLoadingNotes(true);
    void api<Note[]>(`/entities/${encodeURIComponent(entity.id)}/notes`)
      .then((n) => {
        if (current) setNotes(n);
      })
      .catch((e) => {
        if (current) setError(String(e));
      })
      .finally(() => { if (current) setLoadingNotes(false); });
    return () => {
      current = false;
    };
  }, [entity.id, workflow.notes]);
  const mutate = async (path: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      await api(path, body);
      if (path.endsWith("/notes")) setText("");
      await onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="workflow-panel">
      <h3>Investigator workspace</h3>
      <button
        className="button compact"
        disabled={!canEdit || busy}
        onClick={() =>
          void mutate(`/entities/${encodeURIComponent(entity.id)}/watchlist`, {
            watched: !workflow.watchlist.includes(entity.id),
          })
        }
      >
        {workflow.watchlist.includes(entity.id)
          ? "Remove from watchlist"
          : "Add to watchlist"}
      </button>
      <h3>Entity notes</h3>
      {notes.map((n) => (
        <article key={n.id} className="entity-note">
          <p>{n.text}</p>
          <small>
            {n.author} · {new Date(n.createdAt).toLocaleString()}
          </small>
        </article>
      ))}
      {loadingNotes && <p role="status">Loading notes…</p>}
      {!loadingNotes && !notes.length && !error && <p>No notes yet.</p>}
      <label>
        New entity note
        <textarea
          maxLength={4000}
          value={text}
          disabled={!canEdit || busy}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button
        className="button compact"
        disabled={!canEdit || busy || !text.trim()}
        onClick={() =>
          void mutate(`/entities/${encodeURIComponent(entity.id)}/notes`, {
            text,
          })
        }
      >
        Save note
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function AlertTriage({
  alertId,
  triage,
  canEdit,
  onRefresh,
}: {
  alertId: string;
  triage?: Triage;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="triage-control">
      <label>
        Review status
        <select
          aria-label={`Review status ${alertId}`}
          value={triage?.status ?? "New"}
          disabled={!canEdit || busy}
          onChange={async (e) => {
            setBusy(true);
            setError("");
            try {
              await api(`/alerts/${encodeURIComponent(alertId)}/triage`, {
                status: e.target.value,
                version: triage?.version ?? 0,
              });
              await onRefresh();
            } catch (e) {
              setError(`${String(e)} Refreshing current review state.`);
              await onRefresh().catch(() => {});
            } finally {
              setBusy(false);
            }
          }}
        >
          {["New", "Under Review", "Verified", "Dismissed"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <small>Verified means reviewed; it does not establish guilt.</small>
      {triage && (
        <small>
          {triage.author} · {new Date(triage.updatedAt).toLocaleString()}
        </small>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
type Structure = {
  components: number;
  largestComponent: number;
  isolatedNodes: number;
};
type Simulation = {
  before: Structure;
  after: Structure;
  removedEdges: number;
  articulationPoints: string[];
  removedEntityIds: string[];
};
export function SimulationPanel({ entity }: { entity: Entity }) {
  const [result, setResult] = useState<Simulation | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setResult(null);
    setError("");
  }, [entity.id]);
  return (
    <section className="workflow-panel">
      <h3>Structural removal simulation</h3>
      <p>
        Virtually remove {entity.label}. Structural connectivity only; this is
        not an enforcement recommendation. Saved evidence remains unchanged.
      </p>
      <button
        className="button compact"
        disabled={busy || entity.type === "Case"}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setResult(await api("/what-if/remove", { entityIds: [entity.id] }));
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Simulate removal
      </button>
      {result && (
        <>
          <table>
            <thead>
              <tr>
                <th>Measure</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {(
                ["components", "largestComponent", "isolatedNodes"] as const
              ).map((k) => (
                <tr key={k}>
                  <th>
                    {
                      {
                        components: "Components",
                        largestComponent: "Largest component",
                        isolatedNodes: "Isolated nodes",
                      }[k]
                    }
                  </th>
                  <td>{result.before[k]}</td>
                  <td>{result.after[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {result.removedEdges} edges removed virtually. Articulation point:{" "}
            {result.articulationPoints.includes(entity.id) ? "Yes" : "No"}.
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function Exports() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="workflow-panel">
      <h3>Graph exports</h3>
      <p>
        Exports and report data cover the full graph, independent of playback
        and filters. Report images reflect the displayed view.
      </p>
      {[
        ["nodes.csv", "Download nodes CSV"],
        ["edges.csv", "Download edges CSV"],
        ["graph.graphml", "Download GraphML"],
      ].map(([file, label]) => (
        <button
          key={file}
          className="button compact"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await download(`/exports/${file}`, `NEXUS-${file}`);
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {label}
        </button>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function Diagnostics() {
  const [data, setData] = useState<{
      status: string;
      database: { status: string };
      intelligence: { status: string };
      versions: Record<string, string>;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel padded">
      <h2>Service diagnostics</h2>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setData(await api("/diagnostics"));
          } catch (e) {
            setData(null);
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Refresh diagnostics
      </button>
      {data && (
        <dl>
          <dt>Overall</dt>
          <dd>{data.status}</dd>
          <dt>Database</dt>
          <dd>{data.database.status}</dd>
          <dt>Intelligence</dt>
          <dd>{data.intelligence.status}</dd>
          {Object.entries(data.versions).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
