import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Core } from "cytoscape";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  Database,
  Expand,
  FileText,
  GitBranch,
  LayoutDashboard,
  LoaderCircle,
  Network,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  Waypoints,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api, colors, emptyGraph } from "./types";
import type { Graph, IngestResult, PathResult, Quality } from "./types";
import NetworkGraph from "./NetworkGraph";
import Inspector, { HighlightedText } from "./Inspector";
import CaseLinks from "./CaseLinks";
import { motion } from "motion/react";
import AnimatedCount from "./AnimatedCount";
import InvestigationJourney from "./InvestigationJourney";
import TacticalHUD from "./TacticalHUD";
import TacticalGlobe3D from "./TacticalGlobe3D";
import SpotlightCard from "./SpotlightCard";
import IntelCopilot from "./IntelCopilot";

const nav = [
  ["Dashboard", LayoutDashboard],
  ["Investigation", Network],
  ["Data Ingestion", Database],
  ["Alerts", Activity],
  ["Clusters", Boxes],
  ["Timeline", GitBranch],
  ["Reports", FileText],
] as const;
const ruleNames: Record<string, string> = {
  R1: "Shared phone across cases",
  R2: "Shared account connection",
  R3: "Community bridge",
  R4: "Financial pattern",
  R5: "Repeated co-location",
  R6: "Repeated co-accusation",
  R7: "Circular transaction laundering loop",
};
export default function App() {
  const [page, setPage] = useState("Investigation"),
    [graph, setGraph] = useState<Graph>(emptyGraph),
    [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState("");
  const [type, setType] = useState("All types"),
    [caseFilter, setCaseFilter] = useState("All cases"),
    [crime, setCrime] = useState("All crime types"),
    [location, setLocation] = useState(""),
    [date, setDate] = useState("");
  const [expanded, setExpanded] = useState(false),
    [focus, setFocus] = useState(0),
    [filters, setFilters] = useState(false),
    [quality, setQuality] = useState<Quality | null>(null);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [viewMode, setViewMode] = useState<"2d" | "3d">("2d"),
    [path, setPath] = useState<PathResult | null>(null),
    [pathOpen, setPathOpen] = useState(false);
  const [kind, setKind] = useState("fir"),
    [text, setText] = useState(""),
    [caseId, setCaseId] = useState("NXS-007"),
    [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [audit, setAudit] = useState<{ action: string; createdAt: string }[]>(
    [],
  );
  const cy = useRef<Core | null>(null);
  const lastGraphImage = useRef<string | undefined>(undefined);
  const onReady = useCallback((c: Core | null) => {
    if (!c && cy.current && !cy.current.destroyed())
      lastGraphImage.current = cy.current.png({
        output: "base64uri",
        bg: "#13282e",
        maxWidth: 1200,
        maxHeight: 800,
      });
    cy.current = c;
  }, []);
  const refresh = useCallback(async () => {
    const g = await api<Graph>("/graph");
    lastGraphImage.current = undefined;
    setGraph(g);
    setPath(null);
    return g;
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
    void api<Quality>("/quality")
      .then(setQuality)
      .catch(() => {});
  }, [refresh]);
  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };
  const load = () =>
    run("Loading and extracting source records…", async () => {
      await api("/demo/load", {});
      const g = await refresh();
      setNotice(
        `${g.records.length} records loaded · ${g.nodes.length} entities extracted · ready to analyze`,
      );
      setPage("Investigation");
    });
  const reset = () =>
    run("Resetting synthetic investigation…", async () => {
      await api("/demo/reset", {});
      setSelected("");
      setPath(null);
      setCaseFilter("All cases");
      setQuery("");
      await refresh();
      setNotice("Investigation reset. Load the demo to begin again.");
    });
  const analyze = () =>
    run(
      `Analyzing ${graph.nodes.length} entities and ${graph.edges.length} relationships…`,
      async () => {
        await api("/analyze", {});
        const g = await refresh();
        setNotice(
          `Cross-case connections detected · ${g.analysis.counts?.casesLinked ?? 0} cases linked · ${g.analysis.alerts?.filter((a) => !a.suppressed).length ?? 0} leads for review`,
        );
        const shared = g.nodes.find((n) => n.label === "SYN-PHONE-001");
        if (shared) {
          setSelected(shared.id);
          setFocus(1);
        }
      },
    );
  const select = useCallback((id: string) => {
    setSelected(id);
    void api(`/entities/${encodeURIComponent(id)}`).catch(() => {});
  }, []);
  const metrics = useMemo(
    () => new Map(graph.analysis.metrics?.map((m) => [m.entityId, m])),
    [graph.analysis],
  );
  const cases = graph.nodes.filter((n) => n.type === "Case");
  const alerts = graph.analysis.alerts ?? [];
  const activeAlerts = alerts.filter((a) => !a.suppressed);
  const matches = useMemo(
    () =>
      graph.nodes.filter((n) =>
        n.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [graph.nodes, query],
  );
  const visible = useMemo(() => {
    const ranked = [...graph.nodes].sort(
      (a, b) =>
        (metrics.get(b.id)?.influence ?? (b.type === "Case" ? 99 : 0)) -
        (metrics.get(a.id)?.influence ?? (a.type === "Case" ? 99 : 0)),
    );
    const important = new Set(
      graph.analysis.alerts?.flatMap((a) => a.entityIds) ?? [],
    );
    let nodes = expanded
      ? ranked
      : ranked.filter(
          (n, i) =>
            i < 80 ||
            important.has(n.id) ||
            n.id === selected ||
            path?.nodeIds.includes(n.id),
        );
    if (type !== "All types") nodes = nodes.filter((n) => n.type === type);
    if (caseFilter !== "All cases")
      nodes = nodes.filter((n) => n.properties.caseIds.includes(caseFilter));
    if (crime !== "All crime types") {
      const ids = new Set(
        graph.nodes
          .filter((n) => n.type === "Case" && n.properties.crimeType === crime)
          .map((n) => n.label),
      );
      nodes = nodes.filter((n) => n.properties.caseIds.some((c) => ids.has(c)));
    }
    if (location) {
      const lids = new Set(
        graph.nodes
          .filter(
            (n) =>
              n.type === "Location" &&
              n.label.toLowerCase().includes(location.toLowerCase()),
          )
          .map((n) => n.id),
      );
      const related = new Set([
        ...lids,
        ...graph.edges
          .filter((e) => lids.has(e.target) || lids.has(e.source))
          .flatMap((e) => [e.source, e.target]),
      ]);
      nodes = nodes.filter((n) => related.has(n.id));
    }
    if (date) {
      const related = new Set(
        graph.edges
          .filter((e) =>
            e.properties.events.some((x) => x.timestamp.slice(0, 10) === date),
          )
          .flatMap((e) => [e.source, e.target]),
      );
      nodes = nodes.filter((n) => related.has(n.id));
    }
    return new Set(nodes.map((n) => n.id));
  }, [
    graph,
    metrics,
    expanded,
    selected,
    type,
    caseFilter,
    crime,
    location,
    date,
    path,
  ]);
  const exportReport = () =>
    run("Preparing evidence report…", async () => {
      const graphImage =
        cy.current?.png({
          output: "base64uri",
          bg: "#13282e",
          maxWidth: 1200,
          maxHeight: 800,
        }) ?? lastGraphImage.current;
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphImage }),
      });
      if (!response.ok) throw new Error("Report generation failed");
      const blob = new Blob([await response.text()], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "NEXUS-investigation-report.html";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice("Report downloaded. Open it and use Print → Save as PDF.");
    });
  const ingest = (content: string, format: "text" | "json" | "csv") =>
    run("Validating and ingesting records…", async () => {
      let body: unknown;
      if (format === "csv") body = { format: "csv", content };
      else if (format === "json") {
        const parsed: unknown = JSON.parse(content);
        body = Array.isArray(parsed) ? { records: parsed } : parsed;
      } else
        body = {
          records: [
            {
              caseId,
              text: content,
              date: new Date().toISOString(),
              crimeType: "Unspecified",
            },
          ],
        };
      const result = await api<IngestResult>(`/data/${kind}`, body);
      setIngestResult(result);
      await refresh();
      setNotice(
        `${result.accepted} accepted · ${result.duplicates} duplicates · ${result.errors.length} rejected`,
      );
    });
  const files = async (fileList: FileList | null) => {
    if (!fileList) return;
    // Sequential batches retain per-file outcomes rather than racing UI state.
    await run("Reading and validating upload batch…", async () => {
      const total: IngestResult = { accepted: 0, duplicates: 0, errors: [] };
      for (const file of Array.from(fileList)) {
        if (file.size > 2097152)
          throw new Error(`${file.name}: file exceeds 2 MiB`);
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (
          !["txt", "json", "csv"].includes(extension ?? "") ||
          (extension === "txt" && kind !== "fir")
        )
          throw new Error("Use .txt FIR, .json, or .csv files");
        const content = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
        let body: unknown;
        if (extension === "csv") body = { format: "csv", content };
        else if (extension === "json") {
          const data: unknown = JSON.parse(content);
          body = Array.isArray(data) ? { records: data } : data;
        } else
          body = {
            records: [
              {
                caseId,
                text: content,
                date: new Date().toISOString(),
                crimeType: "Unspecified",
              },
            ],
          };
        const result = await api<IngestResult>(`/data/${kind}`, body);
        total.accepted += result.accepted;
        total.duplicates += result.duplicates;
        total.errors.push(
          ...result.errors.map((e) => ({
            ...e,
            message: `${file.name}: ${e.message}`,
          })),
        );
      }
      setIngestResult(total);
      await refresh();
      setNotice(
        `${total.accepted} accepted · ${total.duplicates} duplicates · ${total.errors.length} rejected`,
      );
    });
  };
  const review = (id: string, action: string) =>
    run("Applying investigator review…", async () => {
      setGraph(await api<Graph>(`/link-suggestions/${id}/${action}`, {}));
      setSelected("");
      setNotice("Resolution updated. Re-run analysis to refresh metrics.");
    });
  const stats = [
    ["Source records", graph.records.length, Database],
    ["Entities identified", graph.nodes.length, Waypoints],
    ["Relationships", graph.edges.length, GitBranch],
    ["Leads for review", activeAlerts.length, Activity],
  ] as const;
  const chosen = graph.nodes.find((n) => n.id === selected);
  const timeline = graph.edges
    .filter((e) => !selected || e.source === selected || e.target === selected)
    .flatMap((e) => e.properties.events.map((event) => ({ ...event, edge: e })))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          aria-label="NEXUS Investigation workspace"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Investigation");
          }}
        >
          <div className="brand-symbol">
            <Network size={24} />
          </div>
          <div>
            NEXUS<small>CONNECT THE EVIDENCE</small>
          </div>
        </a>
        <div className="workspace-label">INVESTIGATION SUITE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              aria-label={name}
              title={name}
              className={page === name ? "nav-item active" : "nav-item"}
              onClick={() => setPage(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Alerts" && activeAlerts.length > 0 ? (
                <b>{activeAlerts.length}</b>
              ) : null}
              {name === page ? <ChevronRight size={13} /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className="live-dot" /> LOCAL INTELLIGENCE
          </div>
          <p>
            Evidence-led exploration.
            <br />
            Human-led decisions.
          </p>
          <div className="user">
            <div className="avatar">IN</div>
            <div>
              Investigator<small>Prototype workspace</small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      <main>
        <div className="prototype">
          <ShieldCheck size={13} />
          <b>PROTOTYPE — SYNTHETIC DATA</b>
          <span>All connections are leads for human review</span>
          <span className="offline">
            <i /> Offline-ready pipeline
          </span>
        </div>
        <header>
          <div className="breadcrumb">
            Workspace <ChevronRight size={12} /> <b>{page}</b>
          </div>
          <div className="header-right">
            <span className="pill">DEMO ENVIRONMENT</span>
            <button
              className="icon-button"
              title="Reset demo data"
              aria-label="Reset demo data"
              onClick={reset}
              disabled={!!busy}
            >
              <RotateCcw size={16} />
            </button>
            <div className="avatar small">IN</div>
          </div>
        </header>
        <motion.div key={page} className="page-content" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.35,ease:[.22,1,.36,1]}}>
          <div className="page-title">
            <div>
              <div className="eyebrow">NETWORK EXPLORATION & EXTRACTION</div>
              <h1>
                {page === "Investigation" ? "Investigation workspace" : page}
              </h1>
              <p>
                {page === "Investigation"
                  ? "Separate records. Shared connections. A clearer picture."
                  : "Trace every insight back to the evidence."}
              </p>
            </div>
            <div className="actions">
              <button className="button" onClick={load} disabled={!!busy}>
                <Database size={15} />
                {graph.records.length ? "Reload demo" : "Load demo"}
              </button>
              <button
                className="button primary"
                onClick={analyze}
                disabled={!!busy || !graph.nodes.length}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                Analyze Network
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
          {error ? (
            <div className="status error" role="alert">
              <X size={16} />
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={14} />
              </button>
            </div>
          ) : null}
          {busy || notice ? (
            <div className="status" role="status" aria-live="polite">
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              {busy || notice}
            </div>
          ) : null}
          <div className="stats">
            {stats.map(([label, value, Icon], i) => (
              <motion.div className="stat" key={label} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.4,delay:i*.055}}>
                <div className={`stat-icon s${i}`}>
                  <Icon size={19} />
                </div>
                <div>
                  <span>{label}</span>
                  <strong>
                    <AnimatedCount value={value}/>
                    <small>
                      {i === 3
                        ? "explainable patterns"
                        : i === 0
                          ? "across " + cases.length + " cases"
                          : i === 1
                            ? "evidence-linked"
                            : "source-backed"}
                    </small>
                  </strong>
                </div>
              </motion.div>
            ))}
          </div>

          {page === "Investigation" ? (
            <>
              <InvestigationJourney loaded={graph.records.length>0} analyzed={graph.analyzed} busy={!!busy} onIngest={()=>setPage('Data Ingestion')} onAnalyze={analyze} onExplore={()=>{setFocus(0);cy.current?.fit(undefined,40);}}/>
              <div className="workspace-toolbar">
                <div className="search-wrap">
                  <Search size={16} />
                  <input
                    aria-label="Search entities"
                    placeholder="Search entities, phones, accounts…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query ? (
                    <div className="search-results">
                      {matches.length ? (
                        matches.slice(0, 12).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              select(n.id);
                              setQuery("");
                              setExpanded(true);
                              setType("All types");
                              setCaseFilter("All cases");
                            }}
                          >
                            <i style={{ background: colors[n.type] }} />
                            {n.label}
                            <small>{n.type}</small>
                          </button>
                        ))
                      ) : (
                        <p>No matching entities</p>
                      )}
                    </div>
                  ) : null}
                </div>
                <select
                  aria-label="Entity type filter"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option>All types</option>
                  {Object.keys(colors).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  aria-label="Case filter"
                  value={caseFilter}
                  onChange={(e) => setCaseFilter(e.target.value)}
                >
                  <option>All cases</option>
                  {cases.map((c) => (
                    <option key={c.id}>{c.label}</option>
                  ))}
                </select>
                <button
                  className={`button compact ${filters ? "selected" : ""}`}
                  onClick={() => setFilters(!filters)}
                >
                  <SlidersHorizontal size={14} />
                  Filters
                </button>
                <span className="toolbar-divider" />
                <button
                  className="button compact"
                  onClick={() => setPathOpen(!pathOpen)}
                >
                  <GitBranch size={15} />
                  Find path
                </button>
              </div>
              {filters ? (
                <div className="extra-filters">
                  <label>
                    Crime type
                    <select
                      value={crime}
                      onChange={(e) => setCrime(e.target.value)}
                    >
                      <option>All crime types</option>
                      {[
                        ...new Set(cases.map((c) => c.properties.crimeType)),
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Location
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Navapur…"
                    />
                  </label>
                  <label>
                    Event date
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <button
                    className="button compact"
                    onClick={() => {
                      setType("All types");
                      setCaseFilter("All cases");
                      setCrime("All crime types");
                      setLocation("");
                      setDate("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}
              {pathOpen ? (
                <div className="path-bar">
                  <label>
                    From
                    <select
                      aria-label="Path source"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    >
                      <option value="">Choose an entity</option>
                      {graph.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.type})
                        </option>
                      ))}
                    </select>
                  </label>
                  <ArrowRight size={16} />
                  <label>
                    To
                    <select aria-label="Path target" value={to} onChange={(e) => setTo(e.target.value)}>
                      <option value="">Choose an entity</option>
                      {graph.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.type})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button primary compact"
                    disabled={!from || !to || !!busy}
                    onClick={() =>
                      run("Tracing shortest connection…", async () => {
                        setPath(
                          await api<PathResult>(
                            `/paths?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
                          ),
                        );
                        setExpanded(true);
                        setFocus(0);
                        setType("All types");
                        setCaseFilter("All cases");
                        setCrime("All crime types");
                        setDate("");
                        setLocation("");
                      })
                    }
                  >
                    Trace path
                  </button>
                  {path ? (
                    <span>
                      {path.edges.length} hops ·{" "}
                      {path.edges
                        .map((e) => e.properties.evidenceIds.length)
                        .reduce((a, b) => a + b, 0)}{" "}
                      evidence references
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="investigation-grid">
                <section className="graph-panel">
                  <div className="graph-heading">
                    <div>
                      <span className="live-dot" />
                      <b>Evidence network</b>
                      <span className="graph-state">
                        {graph.analyzed ? "RESOLVED" : "CASE ISLANDS"}
                      </span>
                    </div>
                    <span>
                      {visible.size} / {graph.nodes.length} entities
                    </span>
                  </div>
                  {graph.nodes.length ? (
                    <>
                      <TacticalHUD
                        graph={graph}
                        viewMode={viewMode}
                        onToggleView={setViewMode}
                        analyzed={graph.analyzed}
                      />
                      <div style={{ display: viewMode === "2d" ? "block" : "none" }}>
                        <NetworkGraph
                          graph={graph}
                          visible={visible}
                          selected={selected}
                          focus={focus}
                          path={path?.nodeIds ?? []}
                          onSelect={select}
                          onReady={onReady}
                        />
                      </div>
                      {viewMode === "3d" ? (
                        <TacticalGlobe3D
                          nodes={graph.nodes}
                          edges={graph.edges}
                          selectedId={selected}
                          onSelectNode={select}
                        />
                      ) : null}
                    </>
                  ) : (
                    <div className="graph-empty">
                      <div className="empty-orbit">
                        <Network size={54} />
                      </div>
                      <span className="eyebrow">
                        EVERY CONNECTION STARTS WITH EVIDENCE
                      </span>
                      <h2>See what the records reveal.</h2>
                      <p>
                        Load six synthetic cases to explore shared identifiers,
                        <br />
                        trace financial patterns, and uncover connections.
                      </p>
                      <button
                        className="button primary"
                        onClick={load}
                        disabled={!!busy}
                      >
                        <Database size={16} />
                        Load synthetic investigation
                        <ArrowRight size={16} />
                      </button>
                      <small>
                        121 source records · entirely fictional · fully
                        traceable
                      </small>
                    </div>
                  )}
                  <div className="graph-tools">
                    <button
                      aria-label="Zoom in"
                      onClick={() =>
                        cy.current?.zoom((cy.current?.zoom() ?? 1) * 1.2)
                      }
                    >
                      <ZoomIn size={17} />
                    </button>
                    <button
                      aria-label="Zoom out"
                      onClick={() =>
                        cy.current?.zoom((cy.current?.zoom() ?? 1) / 1.2)
                      }
                    >
                      <ZoomOut size={17} />
                    </button>
                    <button
                      aria-label="Fit network"
                      onClick={() => cy.current?.fit(undefined, 40)}
                    >
                      <Expand size={17} />
                    </button>
                  </div>
                  <div className="graph-bottom">
                    <div className="legend">
                      {Object.entries(colors).map(([name, color]) => (
                        <span key={name}>
                          <i style={{ background: color }} />
                          {name}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => setExpanded(!expanded)}>
                      {expanded ? "Top entities" : "Expand all"}
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="focus-bar">
                    <Target size={14} />
                    <span>Focus mode</span>
                    {[0, 1, 2].map((v) => (
                      <button
                        key={v}
                        className={focus === v ? "active" : ""}
                        disabled={v > 0 && !selected}
                        onClick={() => setFocus(v)}
                      >
                        {v === 0 ? "Off" : `${v} hop${v === 2 ? "s" : ""}`}
                      </button>
                    ))}
                    <span className="graph-hint">
                      {graph.analyzed
                        ? "Color = entity type · outline = community"
                        : "Shared identifiers appear separately inside each case"}
                    </span>
                  </div>
                </section>
                <Inspector
                  graph={graph}
                  selected={selected}
                  onSelect={select}
                />
              </div>
              {path ? (
                <div className="panel path-evidence">
                  <h3>Connection chain · supporting evidence</h3>
                  {path.edges.map((e) => (
                    <p key={e.id}>
                      {graph.nodes.find((n) => n.id === e.source)?.label} →{" "}
                      {graph.nodes.find((n) => n.id === e.target)?.label}
                      <small>
                        {e.type} · {e.properties.evidenceIds.join(", ")}
                      </small>
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="lower-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h3>
                      <Activity size={16} />
                      Network signals
                    </h3>
                    <button onClick={() => setPage("Alerts")}>
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  {activeAlerts.length ? (
                    activeAlerts.slice(0, 3).map((a) => (
                      <button
                        className="signal"
                        key={a.id}
                        onClick={() => {
                          select(
                            a.entityIds.find(
                              (id) =>
                                graph.nodes.find((n) => n.id === id)?.type ===
                                "Phone",
                            ) ?? a.entityIds[0],
                          );
                          setFocus(1);
                        }}
                      >
                        <span className="rule-tag">{a.ruleId}</span>
                        <div>
                          <strong>{ruleNames[a.ruleId]}</strong>
                          <p>{a.explanation}</p>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))
                  ) : (
                    <div className="quiet-state">
                      {graph.records.length
                        ? "Run Analyze Network to surface explainable connections."
                        : "Signals will appear after you load and analyze evidence."}
                    </div>
                  )}
                </section>
                <section className="panel quality">
                  <div className="panel-heading">
                    <h3>
                      <ShieldCheck size={16} />
                      Extraction quality
                    </h3>
                    <span className="tag">GOLD SET</span>
                  </div>
                  {quality ? (
                    <>
                      <div className="quality-scores">
                        <div>
                          <strong>
                            {(quality.precision * 100).toFixed(1)}
                            <small>%</small>
                          </strong>
                          <span>Precision</span>
                        </div>
                        <div>
                          <strong>
                            {(quality.recall * 100).toFixed(1)}
                            <small>%</small>
                          </strong>
                          <span>Recall</span>
                        </div>
                      </div>
                      <p>
                        {quality.samples} labeled synthetic FIRs · exact type +
                        span match
                      </p>
                      <small>
                        Synthetic template evaluation only. Real-world accuracy
                        is not established.
                      </small>
                    </>
                  ) : (
                    <div className="quiet-state">
                      Quality evaluation appears when the intelligence engine is
                      available.
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}

          {page === "Dashboard" ? (
            <div className="two-columns">
              <section className="panel padded">
                <div className="eyebrow">INVESTIGATION OVERVIEW</div>
                <h2>Follow the evidence across cases.</h2>
                <p>
                  Each record is a fragment. NEXUS resolves shared identifiers
                  and connects them to their source.
                </p>
                {cases.map((c) => (
                  <button
                    className="case-row"
                    key={c.id}
                    onClick={() => {
                      setCaseFilter(c.label);
                      select(c.id);
                      setPage("Investigation");
                    }}
                  >
                    <FileText size={20} />
                    <div>
                      <b>{c.label}</b>
                      <span>{c.properties.crimeType}</span>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
                {!cases.length ? (
                  <button className="button primary" onClick={load}>
                    Load demo
                  </button>
                ) : null}
                <div style={{ marginTop: 18 }}>
                  <SpotlightCard className="callout" spotlightColor="rgba(43, 110, 85, 0.22)">
                    <h3>Deterministic Intelligence & Provenance</h3>
                    <p>
                      Probabilistic merging risks connecting innocent individuals
                      to criminal networks. NEXUS requires shared exact
                      identifiers or explicit human approval with reversible audits.
                    </p>
                  </SpotlightCard>
                </div>
              </section>
              <section className="panel padded">
                <h3>Key connected entities</h3>
                {(graph.analysis.metrics ?? []).slice(0, 10).map((m, i) => {
                  const n = graph.nodes.find((n) => n.id === m.entityId);
                  return (
                    <button
                      className="rank-row"
                      key={m.entityId}
                      onClick={() => {
                        select(m.entityId);
                        setPage("Investigation");
                      }}
                    >
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <b>
                        {n?.label}
                        <small>{n?.type}</small>
                      </b>
                      <strong>{m.influence}</strong>
                    </button>
                  );
                })}
                {!graph.analyzed ? (
                  <p className="muted">
                    Analyze the network to compute influence scores.
                  </p>
                ) : null}
              </section>
            </div>
          ) : null}

          {page === "Dashboard" ? (
            <CaseLinks
              graph={graph}
              onSelect={(id) => {
                select(id);
                setPage("Investigation");
                setCaseFilter("All cases");
                setType("All types");
                setFocus(1);
              }}
            />
          ) : null}
          {page === "Data Ingestion" ? (
            <div className="two-columns">
              <section className="panel padded">
                <div className="eyebrow">ADD SOURCE EVIDENCE</div>
                <h2>Bring the fragments together.</h2>
                <p>
                  UTF-8 text, CSV, or JSON. Invalid rows are reported;
                  duplicates are skipped.
                </p>
                <label>
                  Record type
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="fir">FIR / case narrative</option>
                    <option value="cdr">Call detail records</option>
                    <option value="transactions">Financial transactions</option>
                  </select>
                </label>
                <label>
                  Case ID for plain text
                  <input
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                  />
                </label>
                <label className="upload-zone">
                  <Upload size={27} />
                  <b>Select files to upload</b>
                  <span>
                    Multiple files · 2 MiB per file · 500 rows per request
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".txt,.csv,.json"
                    disabled={!!busy}
                    onChange={(e) => {
                      void files(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label>
                  {kind === "fir"
                    ? "Paste FIR text or JSON records"
                    : "Paste JSON records or CSV"}
                  <textarea
                    rows={7}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      kind === "fir"
                        ? "Accused Fictional Name; phone SYN-PHONE-070…"
                        : '[{"caseId":"NXS-007", ...}]'
                    }
                  />
                </label>
                <button
                  className="button primary"
                  disabled={!!busy || !text.trim()}
                  onClick={() =>
                    ingest(
                      text,
                      text.trim().startsWith("[") || text.trim().startsWith("{")
                        ? "json"
                        : kind === "fir"
                          ? "text"
                          : "csv",
                    )
                  }
                >
                  <Upload size={15} />
                  Ingest records
                </button>
                {ingestResult ? (
                  <div className="ingest-result">
                    <b>
                      {ingestResult.accepted} accepted ·{" "}
                      {ingestResult.duplicates} duplicates ·{" "}
                      {ingestResult.errors.length} errors
                    </b>
                    {ingestResult.errors.map((e, i) => (
                      <p key={i} className="error-text">
                        Row {e.row}: {e.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </section>
              <section className="panel padded">
                <h3>Extracted source narratives</h3>
                <p className="muted">
                  Colored spans retain the original text and extraction
                  confidence. Hover over a span to inspect it.
                </p>
                {graph.records
                  .filter((r) => r.kind === "fir")
                  .map((r) => (
                    <div className="fir-card" key={r.id}>
                      <span className="tag">{r.payload.caseId}</span>
                      <HighlightedText record={r} />
                    </div>
                  ))}
                {!graph.records.length ? (
                  <p className="quiet-state">No source records yet.</p>
                ) : null}
              </section>
            </div>
          ) : null}

          {page === "Alerts" ? (
            <>
              <div className="section-intro">
                <h2>Explainable leads</h2>
                <p>
                  Patterns describe connections in existing records. They do not
                  establish wrongdoing.
                </p>
              </div>
              <div className="alert-grid">
                {alerts.map((a) => (
                  <article
                    className={`alert-card ${a.suppressed ? "suppressed" : ""}`}
                    key={a.id}
                  >
                    <div>
                      <span className="rule-tag">{a.ruleId}</span>
                      <span className="tag">
                        {a.suppressed
                          ? "SUPPRESSED · PUBLIC/SERVICE"
                          : "HUMAN REVIEW"}
                      </span>
                    </div>
                    <h3>{ruleNames[a.ruleId]}</h3>
                    <p>{a.explanation}</p>
                    <footer>
                      <span>{a.evidenceIds.length} evidence references</span>
                      <button
                        onClick={() => {
                          select(a.entityIds[0]);
                          setFocus(1);
                          setPage("Investigation");
                        }}
                      >
                        Investigate <ArrowRight size={14} />
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
              {!alerts.length ? (
                <div className="panel quiet-state">
                  Run Analyze Network to evaluate R1–R6 against the source
                  evidence.
                </div>
              ) : null}
              <section className="panel padded review-panel">
                <h2>Possible identity matches</h2>
                <p>
                  Name similarity alone never triggers an automatic merge.
                  Review identifiers and source evidence first.
                </p>
                {graph.suggestions.map((s) => (
                  <div className="review-row" key={s.id}>
                    <div>
                      <b>
                        {graph.nodes.find((n) => n.id === s.left)?.label ??
                          s.left}{" "}
                        ↔{" "}
                        {graph.nodes.find((n) => n.id === s.right)?.label ??
                          "Merged entity"}
                      </b>
                      <p>{s.reason}</p>
                      <small>
                        Similarity {(s.score * 100).toFixed(0)}% · {s.status}
                      </small>
                    </div>
                    <button
                      className="button compact"
                      onClick={() => {
                        select(s.left);
                        setPage("Investigation");
                      }}
                    >
                      Inspect
                    </button>
                    {s.status !== "accepted" ? (
                      <button
                        className="button primary compact"
                        disabled={!!busy}
                        onClick={() => review(s.id, "accept")}
                      >
                        Accept merge
                      </button>
                    ) : null}
                    <button
                      className="button compact"
                      disabled={!!busy}
                      onClick={() => review(s.id, "reject")}
                    >
                      {s.status === "accepted" ? "Undo merge" : "Reject"}
                    </button>
                  </div>
                ))}
              </section>
            </>
          ) : null}

          {page === "Clusters" ? (
            <>
              <div className="section-intro">
                <h2>Network communities</h2>
                <p>
                  Seeded Louvain communities describe connection density, not
                  groups with shared intent.
                </p>
              </div>
              <div className="alert-grid">
                {graph.analysis.communities?.map((c) => (
                  <section className="panel padded" key={c.id}>
                    <span className="tag">
                      COMMUNITY {String(c.id + 1).padStart(2, "0")}
                    </span>
                    <h2>{c.entityIds.length} entities</h2>
                    {c.entityIds.map((id) => {
                      const n = graph.nodes.find((n) => n.id === id);
                      return (
                        <button
                          className="community-entity"
                          key={id}
                          onClick={() => {
                            select(id);
                            setFocus(1);
                            setPage("Investigation");
                          }}
                        >
                          <i
                            style={{ background: colors[n?.type ?? "Case"] }}
                          />
                          {n?.label}
                          <small>{n?.type}</small>
                        </button>
                      );
                    })}
                  </section>
                ))}
              </div>
              {!graph.analyzed ? (
                <div className="panel quiet-state">
                  Run analysis to identify communities.
                </div>
              ) : null}
            </>
          ) : null}

          {page === "Timeline" ? (
            <section className="panel padded">
              <div className="panel-heading">
                <h2>Evidence timeline</h2>
                <select
                  aria-label="Timeline entity"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">All entities</option>
                  {graph.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <p>
                {chosen
                  ? `Events connected to ${chosen.label}`
                  : "All relationship events in chronological order"}
              </p>
              <div className="timeline">
                {timeline.map((event, i) => (
                  <div
                    className="timeline-event"
                    key={`${event.evidenceId}-${i}`}
                  >
                    <time>
                      {new Date(event.timestamp).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      })}
                      <small>UTC</small>
                    </time>
                    <i />
                    <div>
                      <b>{event.edge.type.replaceAll("_", " ")}</b>
                      <p>
                        {
                          graph.nodes.find((n) => n.id === event.edge.source)
                            ?.label
                        }{" "}
                        →{" "}
                        {
                          graph.nodes.find((n) => n.id === event.edge.target)
                            ?.label
                        }
                      </p>
                      <small>
                        {event.evidenceId}
                        {event.amount
                          ? ` · INR ${event.amount.toLocaleString("en-IN")}`
                          : ""}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {page === "Reports" ? (
            <div className="two-columns">
              <section className="panel padded report-card">
                <div className="report-icon">
                  <FileText size={42} />
                </div>
                <span className="eyebrow">EVIDENCE YOU CAN TAKE WITH YOU</span>
                <h2>Investigation report</h2>
                <p>
                  Case summaries, entity influence, relationships, patterns,
                  timeline, and supporting source records in one printable
                  document.
                </p>
                <ul>
                  <li>
                    <Check size={16} />
                    Evidence references for every connection
                  </li>
                  <li>
                    <Check size={16} />
                    Explainable patterns, including suppressed results
                  </li>
                  <li>
                    <Check size={16} />
                    Original source records and extraction spans
                  </li>
                </ul>
                <button
                  className="button primary"
                  disabled={!graph.records.length || !!busy}
                  onClick={exportReport}
                >
                  <ArrowDownToLine size={16} />
                  Generate Investigation Report
                </button>
                <small>
                  HTML download · open and print to PDF.
                  <br />
                  Includes the current or most recently viewed graph image when
                  available.
                </small>
              </section>
              <section className="panel padded">
                <div className="panel-heading">
                  <h3>Audit trail</h3>
                  <button
                    onClick={() =>
                      run("Loading audit events…", async () =>
                        setAudit(await api("/audit")),
                      )
                    }
                  >
                    Refresh <RotateCcw size={13} />
                  </button>
                </div>
                {audit.length ? (
                  audit.map((a, i) => (
                    <div className="audit-row" key={i}>
                      <b>{a.action}</b>
                      <small>{new Date(a.createdAt).toLocaleString()}</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Refresh to view uploads, analysis, entity views, resolution
                    decisions, and exports.
                  </p>
                )}
                <div className="note">
                  This local prototype has no login or role enforcement. Use
                  synthetic data only.
                </div>
              </section>
            </div>
          ) : null}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={13} /> Every insight has a source. Every
              decision stays human.
            </span>
            {page === "Investigation" ? (
              <button
                disabled={!graph.records.length || !!busy}
                onClick={exportReport}
              >
                <FileText size={14} />
                Generate Investigation Report
                <ArrowRight size={13} />
              </button>
            ) : (
              <span>NEXUS / INVESTIGATION SUITE</span>
            )}
          </footer>
        </motion.div>
        <IntelCopilot
          graph={graph}
          onSelectEntity={(id) => {
            select(id);
            setPage("Investigation");
            setFocus(1);
          }}
        />
      </main>
    </div>
  );
}
