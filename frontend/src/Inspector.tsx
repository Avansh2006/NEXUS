import { FileText, Link2, ArrowUpRight } from "lucide-react";
import { colors } from "./types";
import type { Graph, Source } from "./types";

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
  return (
    <aside className="inspector">
      <div className="section-label">
        ENTITY INSPECTOR <span className="live-dot" />
      </div>
      <span className="entity-type" style={{ color: colors[n.type] }}>
        {n.type}
      </span>
      <h2>{n.label}</h2>
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
                <small>{e.type.replaceAll("_", " ")}</small>
              </span>
              <ArrowUpRight size={13} />
            </button>
          );
        })}
      </div>
      <h3>
        <FileText size={15} /> Supporting records <span>{records.length}</span>
      </h3>
      {records.map((r) => (
        <details key={r.id} className="source-record">
          <summary>
            {r.kind.toUpperCase()} · {r.payload.caseId}
          </summary>
          <small>{r.id}</small>
          {r.kind === "fir" ? (
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
