import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, Link2, ArrowUpRight, ScanFace, Plus, Trash2 } from "lucide-react";
import { SupportBadge } from "./Workflow";
import { colors, api, apiForm, apiDelete } from "./types";
import type { Graph, Source, PersonFace } from "./types";

export function HighlightedText({ record }: { record: Source }) {
  const text = record.payload.text ?? "";
  const entities = record.payload._entities ?? [];
  let cursor = 0;
  const parts: React.ReactNode[] = [];
  for (const [i, e] of [...entities]
    .sort((a, b) => a.start - b.start)
    .entries()) {
    if (e.start < cursor) continue;
    parts.push(text.slice(cursor, e.start));
    parts.push(
      <mark
        key={i}
        title={`${e.type} · ${(e.confidence * 100).toFixed(0)}% confidence`}
        style={{
          background: `${colors[e.type as keyof typeof colors] ?? "#e5b45b"}44`,
        }}
      >
        {text.slice(e.start, e.end)}
      </mark>,
    );
    cursor = e.end;
  }
  parts.push(text.slice(cursor));
  return <p className="source-text">{parts}</p>;
}

export default function Inspector({
  graph,
  selected,
  onSelect,
}: {
  graph: Graph;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const n = graph.nodes.find((n) => n.id === selected);
  if (!n)
    return (
      <aside className="inspector">
        <div className="section-label">ENTITY INSPECTOR</div>
        <div className="inspector-empty">
          <Link2 size={38} />
          <h3>Follow a connection.</h3>
          <p>
            Select an entity in the network to inspect its relationships and
            supporting records.
          </p>
        </div>
        <div className="note">
          Every connection leads back to evidence. All findings require human
          review.
        </div>
      </aside>
    );
  const metric = graph.analysis.metrics?.find((m) => m.entityId === n.id);
  const edges = graph.edges.filter(
    (e) => e.source === n.id || e.target === n.id,
  );
  const edgeIds = new Set(edges.map((e) => e.id));
  const evidence = graph.evidence.filter(
    (e) => e.entityId === n.id || (e.edgeId && edgeIds.has(e.edgeId)),
  );
  const recordIds = new Set(evidence.map((e) => e.recordId));
  const records = graph.records.filter((r) => recordIds.has(r.id));
  const alerts =
    graph.analysis.alerts?.filter((a) => a.entityIds.includes(n.id)) ?? [];

  const [faces, setFaces] = useState<PersonFace[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [faceError, setFaceError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFaces = useCallback(async () => {
    if (n && n.type === "Person") {
      try {
        const list = await api<PersonFace[]>(`/persons/${n.id}/faces`);
        setFaces(list ?? []);
      } catch {
        setFaces([]);
      }
    } else {
      setFaces([]);
    }
  }, [n?.id, n?.type]);

  useEffect(() => {
    loadFaces();
    setFaceError("");
  }, [loadFaces]);

  const handleEnrollFace = async (file: File) => {
    if (!n) return;
    setEnrolling(true);
    setFaceError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiForm(`/persons/${n.id}/faces`, formData);
      await loadFaces();
    } catch (err: any) {
      setFaceError(err.message || "Face enrollment failed");
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeleteFace = async (faceId: string) => {
    if (!n) return;
    try {
      await apiDelete(`/persons/${n.id}/faces/${faceId}`);
      await loadFaces();
    } catch (err: any) {
      setFaceError(err.message || "Failed to remove face");
    }
  };

  return (
    <aside className="inspector">
      <div className="section-label">
        ENTITY INSPECTOR <span className="live-dot" />
      </div>
      <span className="entity-type" style={{ color: colors[n.type] }}>
        {n.type}
      </span>
      <h2>{n.label}</h2>
      <SupportBadge support={n.properties.support} />

      {n.type === "Person" && (
        <div style={{ marginTop: 12, marginBottom: 12, background: "#0c181c", border: "1px solid #1c3d35", borderRadius: 8, padding: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#8ab4a3", display: "flex", alignItems: "center", gap: 5 }}>
              <ScanFace size={13} color="#34d399" /> Visual Identity ({faces.length})
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={enrolling}
              style={{
                fontSize: 10,
                padding: "2px 6px",
                background: "#163e34",
                color: "#6ee7b7",
                borderRadius: 4,
                border: "1px solid #286052",
                display: "flex",
                alignItems: "center",
                gap: 3,
                cursor: "pointer"
              }}
            >
              <Plus size={11} /> {enrolling ? "Enrolling..." : "Enroll Photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleEnrollFace(e.target.files[0]);
                  e.target.value = "";
                }
              }}
            />
          </div>

          {faceError && (
            <div style={{ fontSize: 10, color: "#fca5a5", background: "#450a0a", padding: "4px 6px", borderRadius: 4, marginBottom: 6 }}>
              {faceError}
            </div>
          )}

          {faces.length === 0 ? (
            <div style={{ fontSize: 10, color: "#62777c", fontStyle: "italic", textAlign: "center", padding: "4px 0" }}>
              No reference face photo enrolled.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {faces.map((f) => (
                <div
                  key={f.id}
                  style={{
                    position: "relative",
                    minWidth: 70,
                    maxWidth: 75,
                    background: "#081013",
                    border: "1px solid #1a4038",
                    borderRadius: 6,
                    padding: 3,
                    textAlign: "center"
                  }}
                >
                  <img
                    src={f.metadata?.thumbnail || ""}
                    alt="Face"
                    style={{ width: "100%", height: 65, objectFit: "cover", borderRadius: 4, background: "#000" }}
                  />
                  <div style={{ fontSize: 8.5, color: "#6ee7b7", marginTop: 2, fontFamily: "monospace" }}>
                    Q: {(f.qualityScore * 100).toFixed(0)}%
                  </div>
                  <button
                    onClick={() => handleDeleteFace(f.id)}
                    title="Delete face"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      background: "rgba(0,0,0,0.75)",
                      color: "#f87171",
                      borderRadius: "50%",
                      width: 16,
                      height: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {metric?.roleTitle ? (
        <div
          className="role-pattern-card"
          style={{
            marginBottom: 10,
            padding: "8px 10px",
            background: "#132c33",
            borderRadius: 6,
            border: "1px solid #2f5a4e",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              className="pill"
              style={{
                background: "#214a3e",
                color: "#a5f0cd",
                border: "1px solid #3d806a",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {metric.roleTitle}
            </span>
            <span
              style={{ fontSize: 9, color: "#8ab4a3", fontStyle: "italic" }}
            >
              Pattern hypothesis — for investigator review
            </span>
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: "#a1cbba",
              marginTop: 4,
              fontFamily: "monospace",
            }}
          >
            {metric.roleCriteria
              ? `Criteria: ${metric.roleCriteria}`
              : `Criteria: Degree=${(metric.degree * 100).toFixed(1)}%, Betw=${(metric.betweenness * 100).toFixed(1)}%, Inf=${metric.influence.toFixed(1)}`}
          </div>
          {metric.tacticalRole === "PASS_THROUGH_ACCOUNT" ||
          metric.roleTitle?.toLowerCase().includes("pass-through") ? (
            <div
              style={{
                fontSize: 9,
                color: "#f2d385",
                marginTop: 5,
                background: "#332b12",
                padding: "4px 6px",
                borderRadius: 4,
                borderLeft: "2px solid #e0b443",
              }}
            >
              Notice: Account holders may be unwitting participants or victims.
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="tags">
        {n.properties.caseIds.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="influence">
        <div>
          <span>Influence score</span>
          <strong>
            {metric?.influence.toFixed(1) ?? "—"}
            <small>/ 100</small>
          </strong>
        </div>
        <ArrowUpRight size={24} />
      </div>
      {metric ? (
        <div className="breakdown">
          {[
            ["Degree", metric.degree, 0.45],
            ["Betweenness", metric.betweenness, 0.35],
            ["Case count", metric.caseComponent, 0.2],
          ].map(([label, value, weight]) => (
            <div key={String(label)}>
              <span>
                {label} · {Number(weight) * 100}%
              </span>
              <b>{Number(value).toFixed(3)}</b>
              <div className="meter">
                <i style={{ width: `${Number(value) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          Run analysis to compute descriptive connectivity.
        </p>
      )}
      <h3>
        Patterns to review <span>{alerts.length}</span>
      </h3>
      {alerts.map((a) => (
        <div
          className={`mini-alert ${a.suppressed ? "suppressed" : ""}`}
          key={a.id}
        >
          <b>
            {a.ruleId} · {a.suppressed ? "Suppressed" : "Review lead"}
          </b>
          <p>{a.explanation}</p>
          <small>{a.evidenceIds.length} supporting evidence references</small>
        </div>
      ))}
      <h3>
        Connections <span>{edges.length}</span>
      </h3>
      <div className="connections">
        {edges.slice(0, 20).map((e) => {
          const other = graph.nodes.find(
            (x) => x.id === (e.source === n.id ? e.target : e.source),
          );
          return (
            <button key={e.id} onClick={() => onSelect(other?.id ?? "")}>
              <i style={{ background: colors[other?.type ?? "Case"] }} />
              <span>
                {other?.label}
                <small>
                  {e.type.replaceAll("_", " ")}  - {" "}
                  {e.properties.support?.level ?? "Unassessed"} evidence support
                </small>
              </span>
              <ArrowUpRight size={13} />
            </button>
          );
        })}
      </div>
      <details className="source-record"><summary>Relationship support details</summary>{edges.slice(0,20).map(edge=><div key={edge.id}><b>{edge.type.replaceAll("_"," ")}</b><SupportBadge support={edge.properties.support}/></div>)}</details>
      <h3>
        <FileText size={15} /> Supporting records <span>{records.length}</span>
      </h3>
      {records.map((r) => (
        <details key={r.id} className="source-record">
          <summary>
            {r.kind.toUpperCase()} · {r.payload.caseId}
          </summary>
          <small>{r.id}</small>
          <p>
            Reliability: {r.payload.sourceReliability ?? "Unassessed"}  -
            Information credibility:{" "}
            {r.payload.informationCredibility ?? "Unassessed"}
          </p>
          {r.payload.text ? (
            <HighlightedText record={r} />
          ) : (
            <dl>
              {Object.entries(r.payload)
                .filter(([key]) => !key.startsWith("_"))
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
            </dl>
          )}
          <p className="muted">
            {evidence
              .filter((e) => e.recordId === r.id)
              .map(
                (e) =>
                  `${e.id} (row ${e.row}${e.start !== null ? `, span ${e.start}–${e.end}` : ""})`,
              )
              .join(" · ")}
          </p>
        </details>
      ))}
    </aside>
  );
}
