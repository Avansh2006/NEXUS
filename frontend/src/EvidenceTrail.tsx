import { useState, useEffect } from "react";
import {
  Waypoints,
  ArrowRight,
  ShieldCheck,
  Quote,
} from "lucide-react";
import { api } from "./types";
import type { EvidenceTrailResponse, Graph } from "./types";

interface Props {
  graph: Graph;
  onSelectEntity?: (id: string) => void;
}

export default function EvidenceTrail({ graph, onSelectEntity }: Props) {
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [trail, setTrail] = useState<EvidenceTrailResponse | null>(null);
  const [error, setError] = useState<string>("");

  const presets = [
    {
      label: "Aariv Veylan \u2192 Mira Solven",
      from: "Aariv Veylan",
      to: "Mira Solven",
    },
    {
      label: "Aariv Veylan \u2192 Dev Neral",
      from: "Aariv Veylan",
      to: "Dev Neral",
    },
    {
      label: "SYN-PHONE-001 \u2192 SYN-ACCOUNT-001",
      from: "SYN-PHONE-001",
      to: "SYN-ACCOUNT-001",
    },
  ];

  // Auto-fill initial IDs if nodes exist
  useEffect(() => {
    if (graph.nodes.length > 0 && !fromId && !toId) {
      const aariv = graph.nodes.find((n) => n.label === "Aariv Veylan");
      const mira = graph.nodes.find((n) => n.label === "Mira Solven");
      if (aariv && mira) {
        setFromId(aariv.id);
        setToId(mira.id);
        // Automatically fetch initial trail
        fetchTrail(aariv.id, mira.id);
      }
    }
  }, [graph.nodes]);

  const fetchTrail = async (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<EvidenceTrailResponse>(
        `/evidence/path?from=${encodeURIComponent(sourceId)}&to=${encodeURIComponent(targetId)}`
      );
      setTrail(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to trace evidence path");
      setTrail(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (p: typeof presets[0]) => {
    const fNode = graph.nodes.find((n) => n.label === p.from);
    const tNode = graph.nodes.find((n) => n.label === p.to);
    if (fNode && tNode) {
      setFromId(fNode.id);
      setToId(tNode.id);
      fetchTrail(fNode.id, tNode.id);
    }
  };

  const handleRunTrace = () => {
    fetchTrail(fromId, toId);
  };

  const getSourceKindBadge = (kind: string) => {
    switch (kind.toLowerCase()) {
      case "fir":
        return { label: "Police FIR", color: "bg-indigo-100 text-indigo-800 border-indigo-200" };
      case "cdr":
        return { label: "Telco CDR", color: "bg-cyan-100 text-cyan-800 border-cyan-200" };
      case "transactions":
        return { label: "Bank Transfer", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      default:
        return { label: kind, color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Entity Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full uppercase tracking-wider">
              Chain of Custody
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Provenance Path Mode
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mt-1">
            Evidence Trail: Why Are These Entities Connected?
          </h2>
          <p className="text-xs text-slate-500">
            Unpack multi-hop evidentiary paths between any two entities. Every connection is verified by underlying documents with quote-level extraction text.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-semibold text-slate-500">
            Investigative Hypotheses:
          </span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(p)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300 border border-slate-200 rounded-md text-xs font-medium transition"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Selectors Bar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 block mb-1 uppercase tracking-wider">
              From Entity:
            </label>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-white"
            >
              <option value="">Select origin entity...</option>
              {graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label} ({n.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center pt-5 md:pt-4 text-slate-400">
            <ArrowRight size={20} />
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 block mb-1 uppercase tracking-wider">
              To Entity:
            </label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-white"
            >
              <option value="">Select target entity...</option>
              {graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label} ({n.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleRunTrace}
            disabled={loading || !fromId || !toId}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition"
          >
            <Waypoints size={15} />
            {loading ? "Tracing Provenance Graph..." : "Trace Evidence Trail"}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <strong>Path Connection Error:</strong> {error}
        </div>
      )}

      {/* Results View */}
      {trail && (
        <div className="space-y-6">
          {/* Chain Summary Banner */}
          <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <ShieldCheck size={18} className="text-indigo-600" />
              Evidentiary Chain Synthesis
            </div>
            <p className="text-xs text-indigo-800 leading-relaxed font-medium">
              {trail.chainSummary}
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-indigo-700 font-mono">
              <span>Origin: <strong>{trail.fromLabel}</strong></span>
              <span>\u2192</span>
              <span>Target: <strong>{trail.toLabel}</strong></span>
              <span>\u2022</span>
              <span>Paths Found: <strong>{trail.paths.length}</strong></span>
            </div>
          </div>

          {/* Paths Breakdown */}
          {trail.paths.map((p) => (
            <div
              key={p.pathIndex}
              className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Path {p.pathIndex}: {p.totalHops} Hop Connection
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {p.pathSummary}
                </span>
              </div>

              {/* Hop Steps Sequence */}
              <div className="space-y-4">
                {p.steps.map((st, stepIdx) => (
                  <div
                    key={stepIdx}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                  >
                    {/* Hop Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-mono font-bold">
                          Hop {stepIdx + 1}
                        </span>
                        <button
                          onClick={() => onSelectEntity?.(st.sourceNode.id)}
                          className="font-bold text-xs text-slate-900 hover:text-indigo-700 underline"
                        >
                          {st.sourceNode.label}
                        </button>
                        <span className="text-slate-400 font-mono">\u2192</span>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[11px] font-semibold">
                          {st.edge.type}
                        </span>
                        <span className="text-slate-400 font-mono">\u2192</span>
                        <button
                          onClick={() => onSelectEntity?.(st.targetNode.id)}
                          className="font-bold text-xs text-slate-900 hover:text-indigo-700 underline"
                        >
                          {st.targetNode.label}
                        </button>
                      </div>

                      <span className="text-[11px] text-slate-500 font-mono">
                        {st.evidence.length} Forensic Citations
                      </span>
                    </div>

                    {/* Evidence Citations */}
                    <div className="space-y-2 pt-1">
                      {st.evidence.map((ev, evIdx) => {
                        const sBadge = getSourceKindBadge(ev.sourceKind);
                        return (
                          <div
                            key={evIdx}
                            className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold border rounded uppercase ${sBadge.color}`}
                                >
                                  {sBadge.label}
                                </span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-mono">
                                  Case {ev.caseId}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-semibold">
                                  {(ev.confidence * 100).toFixed(0)}% Confidence
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {ev.timestamp ? ev.timestamp.slice(0, 10) : "Historical"}
                              </span>
                            </div>

                            {/* Quote Excerpt */}
                            <div className="p-2.5 bg-slate-50 border-l-2 border-indigo-500 rounded text-slate-800 text-[11px] italic font-serif flex items-start gap-2">
                              <Quote size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                              <span>"{ev.rawExcerpt}"</span>
                            </div>

                            <div className="text-[11px] text-slate-600">
                              <strong>Forensic Grounding:</strong> {ev.rationale}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
