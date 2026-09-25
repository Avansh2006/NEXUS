import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Radio,
  RotateCcw,
  Search,
  ScanFace,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  Waypoints,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Printer,
  Eye,
  Layers,
  Video,
} from "lucide-react";
import VisualIdentitySearch from "./VisualIdentitySearch";
import MultimodalEvidence from "./MultimodalEvidence";
import InvestigationIntelligence from "./InvestigationIntelligence";
import CctvHunt from "./CctvHunt";
import { api, apiRaw, setSession, colors, emptyGraph } from "./types";
import type {
  Session,
  Edge,
  Entity,
  Graph,
  IncomingResult,
  IngestResult,
  PathResult,
  Quality,
  ReplayResponse,
  WhatIfResponse,
  EvidenceTrailResponse,
  EvidenceDetail,
} from "./types";
import NetworkGraph from "./NetworkGraph";
import Inspector, { HighlightedText } from "./Inspector";
import CaseLinks from "./CaseLinks";
import AnimatedCount from "./AnimatedCount";
import InvestigationJourney from "./InvestigationJourney";
import TacticalHUD from "./TacticalHUD";
import SpotlightCard from "./SpotlightCard";
import IntelCopilot from "./IntelCopilot";

import Playback from "./Playback";
import QualityPanel from "./QualityPanel";
import AuditPanel from "./AuditPanel";
import {
  EntityWorkflow,
  AlertTriage,
  SimulationPanel,
  Exports,
  Diagnostics,
  emptyWorkflow,
} from "./Workflow";
import type { Workflow } from "./Workflow";
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Investigation", Network],
  ["Visual Identity", ScanFace],
  ["Multimodal Evidence", Layers],
  ["CCTV Hunt", Video],
  ["Investigation Intelligence", Sparkles],
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

export const DOSSIER_SECTIONS = [
  { id: "summary", label: "1. Case Overview & Scope" },
  { id: "entities", label: "2. Entity Roster & Influence" },
  { id: "vision", label: "3. Visual Identity Verifications (SCRFD + AdaFace)" },
  { id: "evidence", label: "4. Complete Evidence Manifest" },
  { id: "graph", label: "5. Relational Graph Visualization" },
  { id: "trails", label: "6. Provenance & Evidence Trails" },
  { id: "alerts", label: "7. Analytical Leads & Pattern Detections (R1–R7)" },
  { id: "contradictions", label: "8. Contradiction Analysis" },
  { id: "whatIf", label: "9. Counterfactual Impact Assessment" },
  { id: "gaps", label: "10. Investigative Gaps & Missing Leads" },
  { id: "radar", label: "11. Network Evolution Radar" },
  { id: "audit", label: "12. Cryptographic Audit Certificate" },
  { id: "bsa", label: "13. BSA 2023 Section 63 Template" },
  { id: "limitations", label: "14. Safeguards & Limitations Statement" },
  { id: "multimodal", label: "15. Multimodal Evidence & Acoustic/Visual Forensics Manifest" },
] as const;

const TacticalGlobe3D = lazy(() => import("./TacticalGlobe3D"));
export default function App({ session }: { session: Session }) {
  const canEdit = session.role !== "VIEWER",
    isAdmin = session.role === "ADMIN";
  const [workflow, setWorkflow] = useState<Workflow>(emptyWorkflow);
  const [playback, setPlayback] = useState<number | null>(null);
  const refreshWorkflow = useCallback(async () => {
    try {
      const res = await api<Workflow>("/workflow");
      setWorkflow({
        notes: Array.isArray(res?.notes) ? res.notes : [],
        watchlist: Array.isArray(res?.watchlist) ? res.watchlist : [],
        triage: Array.isArray(res?.triage) ? res.triage : [],
      });
    } catch {
      setWorkflow(emptyWorkflow);
    }
  }, []);
  const [page, setPage] = useState("Investigation"),
    [graph, setGraph] = useState<Graph>(emptyGraph),
    [selected, setSelected] = useState("");
  const [intelligenceTab, setIntelligenceTab] = useState<
    "replay" | "what-if" | "contradictions" | "trail" | "gaps" | "radar"
  >("replay");
  const [cctvTargetAssetId, setCctvTargetAssetId] = useState<string>("");
  const pageRef = useRef(page);
  pageRef.current = page;
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
  const [sourceReliability, setSourceReliability] = useState(""),
    [informationCredibility, setInformationCredibility] = useState("");
  const [kind, setKind] = useState("fir"),
    [text, setText] = useState(""),
    [caseId, setCaseId] = useState("NXS-007"),
    [ingestResult, setIngestResult] = useState<IngestResult | null>(null),
    [incomingResult, setIncomingResult] = useState<IncomingResult | null>(null),
    [incomingActive, setIncomingActive] = useState<boolean>(false),
    [metaNodeView, setMetaNodeView] = useState<boolean>(false);

  // 1. Live Replay States
  const [replayActive, setReplayActive] = useState<boolean>(false);
  const [replayResponse, setReplayResponse] = useState<ReplayResponse | null>(null);
  const [replayStepIndex, setReplayStepIndex] = useState<number>(1);
  const [replayPlaying, setReplayPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const replayTimer = useRef<number | null>(null);

  // 2. Counterfactual Simulation States
  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [whatIfResponse, setWhatIfResponse] = useState<WhatIfResponse | null>(null);
  const [simulationMode, setSimulationMode] = useState<"canonical" | "simulation" | "overlay">("overlay");
  const [showOnlyImpacted, setShowOnlyImpacted] = useState<boolean>(false);

  // 3. Evidence Trail States
  const [activeEvidenceTrail, setActiveEvidenceTrail] = useState<EvidenceTrailResponse | null>(null);
  const [selectedPathIndex, setSelectedPathIndex] = useState<number>(0);
  const [clickedEdgeDetail, setClickedEdgeDetail] = useState<{ edge: Edge; evidence: EvidenceDetail[] } | null>(null);
  const [previousSelectedNode, setPreviousSelectedNode] = useState<string>("");

  // 4. Dossier States
  const [selectedDossierSections, setSelectedDossierSections] = useState<Set<string>>(
    new Set([
      "summary", "entities", "vision", "evidence", "graph", "trails", "alerts",
      "contradictions", "whatIf", "gaps", "radar", "audit", "bsa", "limitations"
    ])
  );
  const [dossierPreviewHtml, setDossierPreviewHtml] = useState<string | null>(null);
  const [dossierPreviewing, setDossierPreviewing] = useState<boolean>(false);
  const cy = useRef<Core | null>(null);
  const lastGraphImage = useRef<string | undefined>(undefined);
  const onReady = useCallback((c: Core | null) => {
    if (!c && pageRef.current !== "Investigation" && cy.current && !cy.current.destroyed())
      lastGraphImage.current = cy.current.png({
        output: "base64uri",
        bg: "#13282e",
        maxWidth: 1200,
        maxHeight: 800,
      });
    cy.current = c;
  }, []);
  const refresh = useCallback(async () => {
    try {
      const g = await api<Graph>("/graph");
      lastGraphImage.current = undefined;
      const safeG: Graph = {
        ...emptyGraph,
        ...g,
        nodes: Array.isArray(g?.nodes) ? g.nodes : [],
        edges: Array.isArray(g?.edges) ? g.edges : [],
        records: Array.isArray(g?.records) ? g.records : [],
        evidence: Array.isArray(g?.evidence) ? g.evidence : [],
        suggestions: Array.isArray(g?.suggestions) ? g.suggestions : [],
        analysis: g?.analysis ?? {},
      };
      setGraph(safeG);
      const hasNxs007 = safeG.records.some((r) => r?.payload?.caseId === "NXS-007");
      if (!hasNxs007) setIncomingResult(null);
      setIncomingActive(hasNxs007);
      setPlayback(null);
      await refreshWorkflow();
      setPath(null);
      return safeG;
    } catch (err) {
      setGraph(emptyGraph);
      throw err;
    }
  }, [refreshWorkflow]);
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
      setIncomingResult(null);
      setIncomingActive(false);
      setMetaNodeView(false);
      await refresh();
      setNotice("Investigation reset. Load the demo to begin again.");
    });
  const loadIncoming = () =>
    run("Streaming and extracting incoming FIR NXS-007…", async () => {
      const raw = await api<IncomingResult>("/demo/incoming", {});
      const res = {
        ...raw,
        newNodes: raw.newNodes ?? [],
        crossCaseLinks: raw.crossCaseLinks ?? [],
        latencyMs: raw.latencyMs ?? 0,
      };
      setIncomingResult(res);
      setIncomingActive(true);
      const g = res.graph ? res.graph : await refresh();
      setGraph(g);
      setPlayback(null);
      setPath(null);
      await refreshWorkflow();
      setNotice(
        `⚡ Live FIR ${res.caseId} ingested in ${res.latencyMs.toFixed(1)}ms · ${res.crossCaseLinks.length} cross-case connection${res.crossCaseLinks.length === 1 ? "" : "s"} discovered`,
      );
      if (res.crossCaseLinks.length > 0) {
        setSelected(res.crossCaseLinks[0].entityId);
        setFocus(1);
      }
    });
  const removeIncoming = () =>
    run("Retracting incoming FIR NXS-007…", async () => {
      const res = await api<{ status: string; removed: string; graph: Graph }>(
        "/demo/incoming/remove",
        {},
      );
      setIncomingResult(null);
      setIncomingActive(false);
      const g = res.graph ? res.graph : await refresh();
      setGraph(g);
      setPlayback(null);
      setPath(null);
      await refreshWorkflow();
      setNotice("Incoming FIR NXS-007 retracted from active workspace.");
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
    setSelected((prev) => {
      if (prev && prev !== id) {
        setPreviousSelectedNode(prev);
      }
      return id;
    });
    void api(`/entities/${encodeURIComponent(id)}`).catch(() => {});
  }, []);
  const metrics = useMemo(
    () => new Map(graph.analysis.metrics?.map((m) => [m.entityId, m])),
    [graph.analysis],
  );
  const incomingHighlightNodes = useMemo(() => {
    if (!incomingResult) return undefined;
    return new Set([
      ...incomingResult.newNodes,
      ...incomingResult.crossCaseLinks.map((c) => c.entityId),
    ]);
  }, [incomingResult]);
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
  const filteredGraph = useMemo(() => {
    const edges = graph.edges
      .filter((e) => visible.has(e.source) && visible.has(e.target))
      .map((e) => ({
        ...e,
        properties: {
          ...e.properties,
          events: e.properties.events.filter(
            (x) => !date || x.timestamp.slice(0, 10) === date,
          ),
        },
      }))
      .filter((e) => !date || e.properties.events.length > 0);
    return {
      ...graph,
      nodes: graph.nodes.filter((n) => visible.has(n.id)),
      edges,
    };
  }, [graph, visible, date]);
  const instants = useMemo(
    () =>
      [
        ...new Set(
          filteredGraph.edges
            .flatMap((e) =>
              e.properties.events.map((x) => Date.parse(x.timestamp)),
            )
            .filter(Number.isFinite),
        ),
      ].sort((a, b) => a - b),
    [filteredGraph],
  );
  const playbackGraph = useMemo(() => {
    if (playback === null) return filteredGraph;
    const edges = filteredGraph.edges
      .map((e) => ({
        ...e,
        properties: {
          ...e.properties,
          events: e.properties.events.filter(
            (x) =>
              Number.isFinite(Date.parse(x.timestamp)) &&
              Date.parse(x.timestamp) <= playback,
          ),
        },
      }))
      .filter((e) => e.properties.events.length > 0);
    const ids = new Set(edges.flatMap((e) => [e.source, e.target]));
    return {
      ...filteredGraph,
      edges,
      nodes: filteredGraph.nodes.filter((n) => ids.has(n.id)),
    };
  }, [filteredGraph, playback]);
  const metaGraph: Graph = useMemo(() => {
    if (
      !metaNodeView ||
      !playbackGraph.analyzed ||
      !playbackGraph.analysis.communities?.length
    ) {
      return playbackGraph;
    }
    const communityNodes: Entity[] = [];
    const entityToCommunity = new Map<string, number>();

    playbackGraph.analysis.communities.forEach((c) => {
      c.entityIds.forEach((eid) => entityToCommunity.set(eid, c.id));
      const members = c.entityIds
        .map((eid) => playbackGraph.nodes.find((n) => n.id === eid))
        .filter(Boolean);
      if (!members.length) return;
      const caseIds = Array.from(
        new Set(members.flatMap((m) => m?.properties.caseIds ?? [])),
      );
      communityNodes.push({
        id: `meta-comm-${c.id}`,
        type: "Organization",
        label: `Community #${c.id + 1} (${members.length} nodes)`,
        properties: {
          caseIds,
          evidenceIds: [],
          roles: [`Cluster of ${members.length} entities`],
        },
      });
    });

    const metaEdgeMap = new Map<
      string,
      { source: string; target: string; count: number; caseIds: Set<string> }
    >();
    playbackGraph.edges.forEach((e) => {
      const c1 = entityToCommunity.get(e.source);
      const c2 = entityToCommunity.get(e.target);
      if (c1 !== undefined && c2 !== undefined && c1 !== c2) {
        const u = Math.min(c1, c2);
        const v = Math.max(c1, c2);
        const key = `${u}-${v}`;
        const existing = metaEdgeMap.get(key) ?? {
          source: `meta-comm-${u}`,
          target: `meta-comm-${v}`,
          count: 0,
          caseIds: new Set<string>(),
        };
        existing.count += 1;
        e.properties.caseIds?.forEach((cid) => existing.caseIds.add(cid));
        metaEdgeMap.set(key, existing);
      }
    });

    const metaEdges: Edge[] = Array.from(metaEdgeMap.entries()).map(
      ([key, data]) => ({
        id: `meta-edge-${key}`,
        source: data.source,
        target: data.target,
        type: "CLUSTER_BRIDGE",
        properties: {
          caseIds: Array.from(data.caseIds),
          evidenceIds: [],
          firstSeen: "",
          lastSeen: "",
          events: [],
        },
      }),
    );

    return {
      ...playbackGraph,
      nodes: communityNodes,
      edges: metaEdges,
    };
  }, [playbackGraph, metaNodeView]);
  // 1. Replay memoized helpers & playback timer
  const replayCumulativeNodes = useMemo(() => {
    if (!replayActive || !replayResponse || !replayResponse.steps.length) return null;
    const nodes = new Set<string>();
    for (let i = 0; i < replayStepIndex && i < replayResponse.steps.length; i++) {
      for (const n of replayResponse.steps[i].delta.nodesAdded) {
        nodes.add(n);
      }
    }
    return nodes;
  }, [replayActive, replayResponse, replayStepIndex]);

  const replayNewNodes = useMemo(() => {
    if (!replayActive || !replayResponse || !replayResponse.steps.length) return null;
    const cur = replayResponse.steps[replayStepIndex - 1];
    return cur ? new Set(cur.delta.nodesAdded) : null;
  }, [replayActive, replayResponse, replayStepIndex]);

  const replayNewEdges = useMemo(() => {
    if (!replayActive || !replayResponse || !replayResponse.steps.length) return null;
    const cur = replayResponse.steps[replayStepIndex - 1];
    return cur ? new Set(cur.delta.edgesAdded) : null;
  }, [replayActive, replayResponse, replayStepIndex]);

  useEffect(() => {
    if (replayPlaying && replayResponse && replayResponse.steps.length > 0) {
      replayTimer.current = window.setInterval(() => {
        setReplayStepIndex((prev) => {
          if (prev >= replayResponse.steps.length) {
            setReplayPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000 / replaySpeed);
    } else if (replayTimer.current) {
      clearInterval(replayTimer.current);
      replayTimer.current = null;
    }
    return () => {
      if (replayTimer.current) clearInterval(replayTimer.current);
    };
  }, [replayPlaying, replayResponse, replaySpeed]);

  const startReplayOnCanvas = async (initialData?: ReplayResponse) => {
    setPage("Investigation");
    setReplayActive(true);
    setSimulationActive(false);
    setActiveEvidenceTrail(null);
    if (initialData) {
      setReplayResponse(initialData);
      setReplayStepIndex(1);
      return;
    }
    if (!replayResponse) {
      try {
        const res = await api<ReplayResponse>("/investigation/replay");
        setReplayResponse(res);
        setReplayStepIndex(1);
      } catch {
        setNotice("Failed to load investigation replay data");
      }
    }
  };

  const handleReplayStepChange = (targetStep: number) => {
    if (!replayResponse) return;
    const bounded = Math.max(1, Math.min(targetStep, replayResponse.steps.length));
    setReplayStepIndex(bounded);
  };

  // 2. Counterfactual Canvas Handlers
  const startSimulationOnCanvas = (res: WhatIfResponse) => {
    setWhatIfResponse(res);
    setSimulationActive(true);
    setSimulationMode("overlay");
    setReplayActive(false);
    setActiveEvidenceTrail(null);
    setPage("Investigation");
  };

  const exitSimulation = () => {
    setSimulationActive(false);
    setWhatIfResponse(null);
    setSimulationMode("canonical");
    setShowOnlyImpacted(false);
  };

  // 3. Evidence Trail Canvas Handlers
  const startEvidenceTrailOnCanvas = (trail: EvidenceTrailResponse) => {
    setActiveEvidenceTrail(trail);
    setSelectedPathIndex(0);
    setClickedEdgeDetail(null);
    setSimulationActive(false);
    setReplayActive(false);
    setPage("Investigation");
  };

  const clearEvidenceHighlight = () => {
    setActiveEvidenceTrail(null);
    setSelectedPathIndex(0);
    setClickedEdgeDetail(null);
  };

  const handleEdgeClickOnCanvas = (canonicalEdgeId: string) => {
    if (activeEvidenceTrail && activeEvidenceTrail.paths[selectedPathIndex]) {
      const step = activeEvidenceTrail.paths[selectedPathIndex].steps.find(
        (s) => s.edge.id === canonicalEdgeId,
      );
      if (step) {
        setClickedEdgeDetail({ edge: step.edge, evidence: step.evidence });
        return;
      }
    }
    const edge = graph.edges.find((e) => e.id === canonicalEdgeId);
    if (edge) {
      const evList = graph.evidence.filter((ev) => ev.edgeId === edge.id);
      const evDetails: EvidenceDetail[] = evList.map((ev) => ({
        evidenceId: ev.id,
        sourceRecordId: ev.recordId,
        sourceKind: graph.records.find((r) => r.id === ev.recordId)?.kind ?? "record",
        caseId: String(edge.properties.caseIds?.[0] ?? ""),
        timestamp: String(edge.properties.events?.[0]?.timestamp ?? ""),
        confidence: ev.confidence,
        rawExcerpt: ev.raw,
        rationale: `Direct connection linking ${edge.source} to ${edge.target}`,
      }));
      setClickedEdgeDetail({ edge, evidence: evDetails });
    }
  };

  const handleWhyConnected = async (sourceId: string, targetId: string) => {
    run("Tracing evidence path...", async () => {
      try {
        const res = await api<EvidenceTrailResponse>(
          `/evidence/path?from=${encodeURIComponent(sourceId)}&to=${encodeURIComponent(targetId)}`
        );
        startEvidenceTrailOnCanvas(res);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "No evidence path found between entities");
      }
    });
  };

  // 4. Dossier Payload & Export Handlers
  const generateDossierPayload = () => {
    const graphImage =
      cy.current?.png({
        output: "base64uri",
        bg: "#13282e",
        maxWidth: 1600,
        maxHeight: 1000,
        full: true,
      }) ?? lastGraphImage.current;

    return {
      graphImage,
      sections: Array.from(selectedDossierSections),
      simulationMode: simulationActive ? simulationMode : "canonical",
      whatIfData: simulationActive ? whatIfResponse : null,
      evidenceTrail: activeEvidenceTrail,
    };
  };

  const previewDossier = () =>
    run("Generating dossier preview…", async () => {
      const payload = generateDossierPayload();
      const response = await apiRaw("/reports", payload);
      if (!response.ok) throw new Error("Dossier generation failed");
      const html = await response.text();
      setDossierPreviewHtml(html);
      setDossierPreviewing(true);
    });

  const exportDossier = () =>
    run("Generating official investigation dossier…", async () => {
      const payload = generateDossierPayload();
      const response = await apiRaw("/reports", payload);
      if (!response.ok) throw new Error("Dossier generation failed");
      const blob = new Blob([await response.text()], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "NEXUS-investigation-dossier.html";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice("Investigation Dossier downloaded. Open and use browser Print → Save as PDF.");
    });

  const exportReport = exportDossier;

  const toggleDossierSection = (sectionId: string) => {
    setSelectedDossierSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const selectAllDossierSections = () => {
    setSelectedDossierSections(
      new Set(DOSSIER_SECTIONS.map((s) => s.id))
    );
  };

  const deselectAllDossierSections = () => {
    setSelectedDossierSections(new Set(["summary"]));
  };

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
              ...(sourceReliability ? { sourceReliability } : {}),
              ...(informationCredibility
                ? { informationCredibility: Number(informationCredibility) }
                : {}),
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
          (extension === "txt" &&
            ![
              "fir",
              "criminal-history",
              "intel-report",
              "surveillance-report",
            ].includes(kind))
        )
          throw new Error("Use narrative .txt, .json, or .csv files");
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
                ...(sourceReliability ? { sourceReliability } : {}),
                ...(informationCredibility
                  ? { informationCredibility: Number(informationCredibility) }
                  : {}),
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
      await api<Graph>(`/link-suggestions/${id}/${action}`, {});
      await refresh();
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
  const timeline = playbackGraph.edges
    .filter((e) => visible.has(e.source) && visible.has(e.target))
    .filter((e) => !selected || e.source === selected || e.target === selected)
    .flatMap((e) => e.properties.events.map((event) => ({ ...event, edge: e })))
    .filter((e) => Number.isFinite(Date.parse(e.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
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
          {isAdmin && (
            <button aria-label="Diagnostics" title="Diagnostics" className={page === "Diagnostics" ? "nav-item active" : "nav-item"} onClick={() => setPage("Diagnostics")}>
              <ShieldCheck size={18} /><span>Diagnostics</span>
            </button>
          )}
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
              {session.username}
              <small>{session.role}</small>
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
              disabled={!!busy || !isAdmin}
            >
              <RotateCcw size={16} />
            </button>
            <button className="button compact" onClick={() => setSession(null)}>
              Sign out
            </button>
          </div>
        </header>
        <div
          key={page}
          className="page-content"
        >
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
              <button
                className="button"
                onClick={load}
                disabled={!!busy || !isAdmin}
              >
                <Database size={15} />
                {graph.records.length ? "Reload demo" : "Load demo"}
              </button>
              {incomingActive ? (
                <button
                  className="button incoming-remove-btn"
                  onClick={removeIncoming}
                  disabled={!!busy || !isAdmin}
                  title="Retract simulated incoming FIR NXS-007 from active workspace"
                >
                  <RotateCcw size={15} />
                  Retract NXS-007
                </button>
              ) : (
                <button
                  className="button incoming-fir-btn"
                  onClick={loadIncoming}
                  disabled={!!busy || !graph.nodes.length || !isAdmin}
                  title="Simulate live streaming ingestion of incoming FIR (NXS-007) linking into existing cases"
                >
                  <Radio size={15} className="text-amber-400 animate-pulse" />
                  Stream FIR NXS-007
                </button>
              )}
              <button
                className="button primary"
                onClick={analyze}
                disabled={!!busy || !graph.nodes.length || !canEdit}
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
            <div className="status" role="status" aria-label="Investigation status" aria-live="polite">
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              {busy || notice}
            </div>
          ) : null}
          {incomingResult ? (
            <div className="incoming-badge flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#221c10] border border-[#d97706] text-[#fcd34d] text-xs font-mono mb-4 shadow-lg shadow-amber-950/20">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-400 flex-shrink-0" />
                <span>
                  <strong>STREAMED FIR {incomingResult.caseId}</strong> ·
                  Ingested & linked in{" "}
                  <span className="text-white font-bold bg-amber-900/60 px-1.5 py-0.5 rounded">
                    {incomingResult.latencyMs.toFixed(1)}ms
                  </span>{" "}
                  · {incomingResult.crossCaseLinks.length} cross-case connection
                  {incomingResult.crossCaseLinks.length === 1 ? "" : "s"}{" "}
                  discovered
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {incomingResult.crossCaseLinks.map((cc) => (
                  <button
                    key={cc.entityId}
                    type="button"
                    className="px-2 py-0.5 rounded bg-[#3b2d15] text-[#fde68a] text-[11px] border border-[#78350f] hover:border-amber-400 transition-colors"
                    onClick={() => {
                      setSelected(cc.entityId);
                      setFocus(1);
                    }}
                    title={`Focus node ${cc.label}`}
                  >
                    🔗 {cc.label} ({cc.cases.join(", ")})
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!isAdmin || !!busy}
                  onClick={removeIncoming}
                  className="ml-2 text-xs text-amber-300 underline hover:text-white"
                >
                  Retract
                </button>
              </div>
            </div>
          ) : null}
          <div className="stats">
            {stats.map(([label, value, Icon], i) => (
              <div
                className="stat"
                key={label}
              >
                <div className={`stat-icon s${i}`}>
                  <Icon size={19} />
                </div>
                <div>
                  <span>{label}</span>
                  <strong>
                    <AnimatedCount value={value} />
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
              </div>
            ))}
          </div>

          {(page === "Investigation" || page === "Timeline") && (
            <Playback
              instants={instants}
              value={playback}
              onChange={setPlayback}
              resetKey={page}
            />
          )}
          {page === "Investigation" ? (
            <>
              <InvestigationJourney
                loaded={graph.records.length > 0}
                analyzed={graph.analyzed}
                busy={!!busy || !canEdit}
                onIngest={() => setPage("Data Ingestion")}
                onAnalyze={analyze}
                onExplore={() => {
                  setFocus(0);
                  cy.current?.fit(undefined, 40);
                }}
              />
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
                    <select
                      aria-label="Path target"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    >
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
                        metaNodeView={metaNodeView}
                        onToggleMetaNode={() => setMetaNodeView((v) => !v)}
                      />
                      {simulationActive && (
                        <div
                          className="simulation-banner"
                          style={{
                            background: "#450a0a",
                            border: "1px solid #dc2626",
                            color: "#fee2e2",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            marginBottom: "8px",
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <AlertTriangle size={16} color="#ef4444" />
                            <span style={{ fontWeight: 700, fontSize: "12px", letterSpacing: "0.5px" }}>
                              SIMULATION MODE — Canonical investigation unchanged
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <div style={{ display: "inline-flex", background: "#1c1917", borderRadius: "4px", padding: "2px" }}>
                              {(["canonical", "simulation", "overlay"] as const).map((m) => (
                                <button
                                  key={m}
                                  className={`button compact ${simulationMode === m ? "primary" : ""}`}
                                  style={{ fontSize: "10px", padding: "2px 8px" }}
                                  onClick={() => setSimulationMode(m)}
                                >
                                  {m.charAt(0).toUpperCase() + m.slice(1)}
                                </button>
                              ))}
                            </div>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", cursor: "pointer", color: "#fca5a5" }}>
                              <input
                                type="checkbox"
                                checked={showOnlyImpacted}
                                onChange={(e) => setShowOnlyImpacted(e.target.checked)}
                              />
                              Only Impacted
                            </label>
                            <button
                              className="button compact"
                              style={{ background: "#dc2626", color: "#ffffff", border: "none", fontSize: "11px", fontWeight: 600 }}
                              onClick={exitSimulation}
                            >
                              Exit Simulation
                            </button>
                          </div>
                        </div>
                      )}

                      {activeEvidenceTrail && (
                        <div
                          className="evidence-trail-banner"
                          style={{
                            background: "#0c4a6e",
                            border: "1px solid #0284c7",
                            color: "#e0f2fe",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            marginBottom: "8px",
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Waypoints size={16} color="#38bdf8" />
                            <span style={{ fontWeight: 700, fontSize: "12px" }}>EVIDENCE TRAIL:</span>
                            <span style={{ fontSize: "12px" }}>
                              {activeEvidenceTrail.fromLabel} &harr; {activeEvidenceTrail.toLabel}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            {activeEvidenceTrail.paths.map((p, idx) => (
                              <button
                                key={idx}
                                className={`button compact ${selectedPathIndex === idx ? "primary" : ""}`}
                                style={{ fontSize: "10px", padding: "2px 8px" }}
                                onClick={() => setSelectedPathIndex(idx)}
                              >
                                Path {p.pathIndex} ({p.totalHops} hops)
                              </button>
                            ))}
                            <button
                              className="button compact"
                              style={{ fontSize: "11px" }}
                              onClick={clearEvidenceHighlight}
                            >
                              Clear Evidence Highlight
                            </button>
                          </div>
                        </div>
                      )}

                      {clickedEdgeDetail && (
                        <div
                          className="evidence-callout-overlay"
                          style={{
                            position: "relative",
                            background: "#0f172a",
                            border: "1px solid #38bdf8",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            marginBottom: "8px",
                            color: "#f8fafc",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>
                              EVIDENTIARY CONNECTION: {clickedEdgeDetail.edge.type}
                            </span>
                            <button
                              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px" }}
                              onClick={() => setClickedEdgeDetail(null)}
                            >
                              &times;
                            </button>
                          </div>
                          <div style={{ fontSize: "12px", lineHeight: "1.5" }}>
                            <div>
                              <b>From:</b> {clickedEdgeDetail.edge.source} &rarr; <b>To:</b> {clickedEdgeDetail.edge.target}
                            </div>
                            {clickedEdgeDetail.evidence.length > 0 && (
                              <div style={{ marginTop: "4px" }}>
                                <div>
                                  <b>Source:</b> <code>{clickedEdgeDetail.evidence[0].sourceRecordId}</code> ({clickedEdgeDetail.evidence[0].sourceKind})
                                  {clickedEdgeDetail.evidence[0].timestamp && <span> | <b>Time:</b> {clickedEdgeDetail.evidence[0].timestamp}</span>}
                                  <span> | <b>Evidence ID:</b> <code>{clickedEdgeDetail.evidence[0].evidenceId}</code></span>
                                </div>
                                <div style={{ margin: "6px 0", padding: "6px 10px", background: "#1e293b", borderLeft: "3px solid #38bdf8", fontStyle: "italic", fontSize: "11px" }}>
                                  &ldquo;{clickedEdgeDetail.evidence[0].rawExcerpt}&rdquo;
                                </div>
                                <button
                                  className="button compact primary"
                                  style={{ fontSize: "10px", marginTop: "2px" }}
                                  onClick={() => {
                                    setQuery(clickedEdgeDetail.evidence[0].sourceRecordId);
                                    setNotice(`Showing evidence for record ${clickedEdgeDetail.evidence[0].sourceRecordId}`);
                                  }}
                                >
                                  Open Source Record
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {replayActive && (
                        <div
                          className="replay-hud"
                          style={{
                            background: "#0f172a",
                            border: "1px solid #10b981",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            marginBottom: "8px",
                            color: "#f8fafc",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <RotateCcw size={16} color="#10b981" />
                              <span style={{ fontWeight: 700, fontSize: "12px" }}>INVESTIGATION REPLAY</span>
                              <span style={{ background: "#064e3b", color: "#6ee7b7", padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600 }}>
                                STEP {replayStepIndex} / {replayResponse?.steps.length ?? 121}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <button
                                className="button compact"
                                onClick={() => handleReplayStepChange(replayStepIndex - 1)}
                                disabled={replayStepIndex <= 1}
                                title="Previous Step"
                              >
                                <SkipBack size={12} />
                              </button>
                              <button
                                className="button compact primary"
                                onClick={() => setReplayPlaying(!replayPlaying)}
                              >
                                {replayPlaying ? <Pause size={12} /> : <Play size={12} />}
                                {replayPlaying ? "Pause" : "Play"}
                              </button>
                              <button
                                className="button compact"
                                onClick={() => handleReplayStepChange(replayStepIndex + 1)}
                                disabled={replayStepIndex >= (replayResponse?.steps.length ?? 121)}
                                title="Next Step"
                              >
                                <SkipForward size={12} />
                              </button>
                              {[0.5, 1, 2, 5].map((s) => (
                                <button
                                  key={s}
                                  className={`button compact ${replaySpeed === s ? "primary" : ""}`}
                                  style={{ fontSize: "10px", padding: "2px 6px" }}
                                  onClick={() => setReplaySpeed(s)}
                                >
                                  {s}x
                                </button>
                              ))}
                              <button
                                className="button compact"
                                style={{ fontSize: "11px", marginLeft: "4px" }}
                                onClick={() => setReplayActive(false)}
                              >
                                Exit Replay
                              </button>
                            </div>
                          </div>

                          <input
                            type="range"
                            aria-label="Replay scrubber"
                            min={1}
                            max={Math.max(1, replayResponse?.steps.length ?? 121)}
                            value={replayStepIndex}
                            onChange={(e) => handleReplayStepChange(Number(e.target.value))}
                            onInput={(e: any) => handleReplayStepChange(Number(e.target.value))}
                            style={{ width: "100%", accentColor: "#10b981", margin: "4px 0" }}
                          />

                          {replayResponse?.steps[replayStepIndex - 1] && (() => {
                            const cur = replayResponse.steps[replayStepIndex - 1];
                            return (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "#94a3b8", marginTop: "4px", flexWrap: "wrap", gap: "6px" }}>
                                <div>
                                  Evidence:{" "}
                                  <b
                                    style={{ color: "#38bdf8", cursor: "pointer", textDecoration: "underline" }}
                                    onClick={() => {
                                      setQuery(cur.recordId);
                                      setNotice(`Inspecting record ${cur.recordId}`);
                                    }}
                                  >
                                    {cur.recordId}
                                  </b>{" "}
                                  ({cur.kind}) ingested
                                  {" | "}
                                  Changes: <span style={{ color: "#10b981" }}>+{cur.delta.nodesAdded.length} nodes</span>, <span style={{ color: "#10b981" }}>+{cur.delta.edgesAdded.length} edges</span>
                                  {cur.delta.alertsTriggered.length > 0 && (
                                    <span style={{ color: "#f59e0b" }}> ({cur.delta.alertsTriggered.join(", ")} activated)</span>
                                  )}
                                </div>
                                <div>
                                  Cumulative: <b>{cur.cumulative.nodeCount}</b> entities, <b>{cur.cumulative.edgeCount}</b> links
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div
                        style={{
                          display: viewMode === "2d" ? "block" : "none",
                        }}
                      >
                        <NetworkGraph
                          graph={
                            metaNodeView
                              ? metaGraph
                              : playbackGraph
                          }
                          visible={
                            metaNodeView
                              ? new Set(metaGraph.nodes.map((n) => n.id))
                              : visible
                          }
                          selected={selected}
                          focus={metaNodeView ? 0 : focus}
                          path={path?.nodeIds ?? []}
                          incomingHighlightNodes={incomingHighlightNodes}
                          onSelect={select}
                          onReady={onReady}
                          simulationMode={simulationActive ? simulationMode : "canonical"}
                          whatIfResponse={simulationActive ? whatIfResponse : null}
                          showOnlyImpacted={showOnlyImpacted}
                          evidencePath={activeEvidenceTrail ? activeEvidenceTrail.paths[selectedPathIndex] : null}
                          replayVisibleNodes={replayActive ? replayCumulativeNodes : null}
                          replayNewNodes={replayActive ? replayNewNodes : null}
                          replayNewEdges={replayActive ? replayNewEdges : null}
                          onEdgeSelect={handleEdgeClickOnCanvas}
                        />
                      </div>
                      {viewMode === "3d" ? (
                        <Suspense fallback={<div className="graph-loading" role="status">Loading 3D network…</div>}>
                        <TacticalGlobe3D
                          nodes={playbackGraph.nodes.filter((n) =>
                            visible.has(n.id),
                          )}
                          edges={playbackGraph.edges.filter(
                            (e) =>
                              visible.has(e.source) && visible.has(e.target),
                          )}
                          selectedId={selected}
                          onSelectNode={select}
                        />
                        </Suspense>
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
                        disabled={!!busy || !isAdmin}
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
                  onNavigateToIntelligence={(t) => {
                    setIntelligenceTab(t as any);
                    setPage("Investigation Intelligence");
                  }}
                  whatIfResponse={simulationActive ? whatIfResponse : null}
                  simulationMode={simulationActive ? simulationMode : "canonical"}
                  previousSelectedNode={previousSelectedNode}
                  onWhyConnected={handleWhyConnected}
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
                                graph?.nodes?.find((n) => n.id === id)?.type ===
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
                          <AlertTriage
                            alertId={a.id}
                            triage={workflow?.triage?.find(
                              (t) => t.alertId === a.id,
                            )}
                            canEdit={canEdit}
                            onRefresh={refreshWorkflow}
                          />
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
                <QualityPanel quality={quality}/>
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
                  <button
                    className="button primary"
                    onClick={load}
                    disabled={!isAdmin}
                  >
                    Load demo
                  </button>
                ) : null}
                <div style={{ marginTop: 18 }}>
                  <SpotlightCard
                    className="callout"
                    spotlightColor="rgba(43, 110, 85, 0.22)"
                  >
                    <h3>Deterministic Intelligence & Provenance</h3>
                    <p>
                      Probabilistic merging risks connecting innocent
                      individuals to criminal networks. NEXUS requires shared
                      exact identifiers or explicit human approval with
                      reversible audits.
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

          {page === "Visual Identity" ? (
            <VisualIdentitySearch
              graph={graph}
              session={session}
              onNavigateToPerson={(personId) => {
                select(personId);
                setPage("Investigation");
                setFocus(1);
              }}
              onRefreshGraph={refresh}
            />
          ) : null}

          {page === "Multimodal Evidence" ? (
            <MultimodalEvidence
              graph={graph}
              session={session}
              onNavigateToEntity={(entityId) => {
                select(entityId);
                setPage("Investigation");
                setFocus(1);
              }}
              onNavigateToCctvHunt={(assetId) => {
                setCctvTargetAssetId(assetId);
                setPage("CCTV Hunt");
              }}
              onRefreshGraph={refresh}
            />
          ) : null}

          {page === "CCTV Hunt" ? (
            <CctvHunt
              graph={graph}
              session={session}
              initialAssetId={cctvTargetAssetId}
              onNavigateToEntity={(entityId) => {
                select(entityId);
                setPage("Investigation");
                setFocus(1);
              }}
              onNavigateToMultimodal={() => setPage("Multimodal Evidence")}
            />
          ) : null}

          {page === "Investigation Intelligence" ? (
            <InvestigationIntelligence
              graph={graph}
              session={session}
              defaultTab={intelligenceTab}
              onSelectEntity={(entityId) => {
                select(entityId);
                setPage("Investigation");
                setFocus(1);
              }}
              onLaunchReplayOnCanvas={startReplayOnCanvas}
              onLaunchWhatIfOnCanvas={startSimulationOnCanvas}
              onLaunchEvidencePathOnCanvas={startEvidenceTrailOnCanvas}
            />
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
                    <option value="criminal-history">Criminal history</option>
                    <option value="intel-report">Intelligence report</option>
                    <option value="surveillance-report">
                      Surveillance report
                    </option>
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
                <div className="two-columns">
                  <label>
                    Source reliability
                    <select
                      value={sourceReliability}
                      onChange={(e) => setSourceReliability(e.target.value)}
                    >
                      <option value="">Unassessed</option>
                      {["A", "B", "C", "D", "E", "F"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Information credibility
                    <select
                      value={informationCredibility}
                      onChange={(e) =>
                        setInformationCredibility(e.target.value)
                      }
                    >
                      <option value="">Unassessed</option>
                      {[1, 2, 3, 4, 5, 6].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="muted">
                  Grades apply to plain-text uploads. JSON/CSV records carry
                  their own grades.
                </p>
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
                    disabled={!!busy || !canEdit}
                    onChange={(e) => {
                      void files(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label>
                  {[
                    "fir",
                    "criminal-history",
                    "intel-report",
                    "surveillance-report",
                  ].includes(kind)
                    ? "Paste FIR text or JSON records"
                    : "Paste JSON records or CSV"}
                  <textarea
                    rows={7}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      [
                        "fir",
                        "criminal-history",
                        "intel-report",
                        "surveillance-report",
                      ].includes(kind)
                        ? "Accused Fictional Name; phone SYN-PHONE-070…"
                        : '[{"caseId":"NXS-007", ...}]'
                    }
                  />
                </label>
                <button
                  className="button primary"
                  disabled={!!busy || !text.trim() || !canEdit}
                  onClick={() =>
                    ingest(
                      text,
                      text.trim().startsWith("[") || text.trim().startsWith("{")
                        ? "json"
                        : [
                              "fir",
                              "criminal-history",
                              "intel-report",
                              "surveillance-report",
                            ].includes(kind)
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
                  .filter((r) => !!r.payload.text)
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
                    <AlertTriage
                      alertId={a.id}
                      triage={workflow?.triage?.find((t) => t.alertId === a.id)}
                      canEdit={canEdit}
                      onRefresh={refreshWorkflow}
                    />
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
                        {graph?.nodes?.find((n) => n.id === s.left)?.label ??
                          s.left}{" "}
                        ↔{" "}
                        {graph?.nodes?.find((n) => n.id === s.right)?.label ??
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
                        disabled={!!busy || !canEdit}
                        onClick={() => review(s.id, "accept")}
                      >
                        Accept merge
                      </button>
                    ) : null}
                    <button
                      className="button compact"
                      disabled={!!busy || !canEdit}
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
                      const n = graph?.nodes?.find((n) => n.id === id);
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
                          graph?.nodes?.find((n) => n.id === event.edge.source)
                            ?.label
                        }{" "}
                        →{" "}
                        {
                          graph?.nodes?.find((n) => n.id === event.edge.target)
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
                <Exports />
                <div className="report-icon">
                  <FileText size={42} />
                </div>
                <span className="eyebrow">JUDICIAL EVIDENTIARY REPORTING</span>
                <h2>Investigation Dossier Export</h2>
                <p>
                  Comprehensive, court-ready dossier incorporating evidence manifests,
                  entity influence, SCRFD+AdaFace biometric matching, explainable patterns (R1–R7),
                  contradiction analysis, counterfactual simulations, investigation gaps, and SHA-256
                  hash-chained audit verification.
                </p>

                {simulationActive && (
                  <div
                    style={{
                      background: "#450a0a",
                      border: "1px solid #dc2626",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      marginBottom: "14px",
                      color: "#fecaca",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <AlertTriangle size={18} color="#ef4444" />
                    <div>
                      <b>SIMULATION MODE ACTIVE:</b> Dossier will be watermarked with{" "}
                      <code>SIMULATION / WHAT-IF HYPOTHETICAL — NOT CANONICAL EVIDENCE</code> and
                      will include baseline vs simulation impact metrics.
                    </div>
                  </div>
                )}

                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "14px",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                      borderBottom: "1px solid #334155",
                      paddingBottom: "6px",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Dossier Sections ({selectedDossierSections.size}/{DOSSIER_SECTIONS.length})
                    </span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        className="button compact"
                        style={{ fontSize: "10px", padding: "2px 6px" }}
                        onClick={selectAllDossierSections}
                      >
                        All
                      </button>
                      <button
                        className="button compact"
                        style={{ fontSize: "10px", padding: "2px 6px" }}
                        onClick={deselectAllDossierSections}
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                      gap: "6px",
                      maxHeight: "220px",
                      overflowY: "auto",
                      overflowX: "hidden",
                      paddingRight: "2px",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {DOSSIER_SECTIONS.map((sec) => (
                      <label
                        key={sec.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12px",
                          cursor: "pointer",
                          padding: "4px 6px",
                          borderRadius: "4px",
                          background: selectedDossierSections.has(sec.id) ? "rgba(56, 189, 248, 0.08)" : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDossierSections.has(sec.id)}
                          onChange={() => toggleDossierSection(sec.id)}
                          style={{ cursor: "pointer" }}
                        />
                        <span style={{ color: selectedDossierSections.has(sec.id) ? "#f8fafc" : "#94a3b8" }}>
                          {sec.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                  <button
                    className="button"
                    disabled={!graph.records.length || !!busy}
                    onClick={previewDossier}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Eye size={16} />
                    Preview Dossier
                  </button>
                  <button
                    className="button primary"
                    disabled={!graph.records.length || !!busy}
                    onClick={exportDossier}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <ArrowDownToLine size={16} />
                    Generate Investigation Report
                  </button>
                </div>
                <small style={{ marginTop: "10px", display: "block", color: "#94a3b8" }}>
                  Exported as an official standalone HTML dossier formatted for judicial review.
                  <br />
                  Open in any browser and use <b>Print &rarr; Save as PDF</b> for an unassailable evidentiary record.
                </small>
              </section>
              <AuditPanel/>
            </div>
          ) : null}
          {page === "Diagnostics" && isAdmin && <Diagnostics />}
          {page === "Investigation" && chosen && (
            <div className="two-columns">
              <EntityWorkflow
                key={chosen.id}
                entity={chosen}
                workflow={workflow}
                canEdit={canEdit}
                onRefresh={refreshWorkflow}
              />
              <SimulationPanel key={`sim-${chosen.id}`} entity={chosen} />
            </div>
          )}
          {page === "Investigation" && (
            <section className="workflow-panel">
              <h3>My watchlist</h3>
              {workflow?.watchlist?.length ? (
                workflow.watchlist.map((id) => (
                  <button
                    className="button compact"
                    key={id}
                    onClick={() => select(id)}
                  >
                    {graph?.nodes?.find((n) => n.id === id)?.label ?? id}
                  </button>
                ))
              ) : (
                <p>No watched entities.</p>
              )}
            </section>
          )}
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
        </div>
        <IntelCopilot
          graph={graph}
          onSelectEntity={(id) => {
            select(id);
            setPage("Investigation");
            setFocus(1);
          }}
        />

        {dossierPreviewing && dossierPreviewHtml && (
          <div
            className="dossier-preview-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.75)",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
            }}
          >
            <div
              className="dossier-preview-modal"
              style={{
                width: "100%",
                maxWidth: "1150px",
                height: "90vh",
                background: "#ffffff",
                color: "#0f172a",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 20px",
                  background: "#0f172a",
                  color: "#ffffff",
                  borderBottom: "1px solid #334155",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FileText size={18} color="#38bdf8" />
                  <span style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "0.5px" }}>
                    INVESTIGATION DOSSIER — LIVE PREVIEW
                  </span>
                  {simulationActive && (
                    <span
                      style={{
                        background: "#7f1d1d",
                        color: "#fecaca",
                        border: "1px solid #ef4444",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      SIMULATION MODE
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    className="button compact primary"
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={() => {
                      const iframe = document.getElementById("dossier-preview-frame") as HTMLIFrameElement | null;
                      iframe?.contentWindow?.print();
                    }}
                  >
                    <Printer size={14} />
                    Print / Save to PDF
                  </button>
                  <button
                    className="button compact"
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={exportDossier}
                  >
                    <ArrowDownToLine size={14} />
                    Download HTML
                  </button>
                  <button
                    className="button compact"
                    style={{ fontSize: "16px", padding: "4px 10px" }}
                    onClick={() => setDossierPreviewing(false)}
                    aria-label="Close preview"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, position: "relative", background: "#f8fafc" }}>
                <iframe
                  id="dossier-preview-frame"
                  srcDoc={dossierPreviewHtml}
                  title="Investigation Dossier Preview"
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
