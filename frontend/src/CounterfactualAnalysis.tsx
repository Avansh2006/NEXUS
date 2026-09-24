import { useState } from "react";
import {
  GitBranch,
  ShieldCheck,
  Play,
  RotateCcw,
  Plus,
  X,
  Network,
  Info,
} from "lucide-react";
import { api } from "./types";
import type { WhatIfRequest, WhatIfResponse } from "./types";

interface Props {
  onSelectEntity?: (id: string) => void;
}

export default function CounterfactualAnalysis({ onSelectEntity }: Props) {
  const [excludeIdentifiers, setExcludeIdentifiers] = useState<string[]>([
    "SYN-PHONE-061",
  ]);
  const [excludeSources, setExcludeSources] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [error, setError] = useState<string>("");

  const presets = [
    {
      title: "Exclude Decoy Identifier SYN-PHONE-061",
      description: "Test if Case NXS-006 is severed when the unverified phone is excluded.",
      identifiers: ["SYN-PHONE-061"],
      sources: [],
    },
    {
      title: "Exclude Pass-Through Account SYN-ACCOUNT-001",
      description: "Test if the layering money laundering chain collapses without the central fan-in hub.",
      identifiers: ["SYN-ACCOUNT-001"],
      sources: [],
    },
    {
      title: "Exclude Case NXS-002 (Mira Solven Fraud)",
      description: "Simulate removing FIR NXS-002 to inspect if the syndicate link to Aariv Veylan breaks.",
      identifiers: ["Mira Solven"],
      sources: [],
    },
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    setExcludeIdentifiers([...p.identifiers]);
    setExcludeSources([...p.sources]);
    setResult(null);
  };

  const handleAddIdentifier = () => {
    const val = customInput.trim();
    if (val && !excludeIdentifiers.includes(val)) {
      setExcludeIdentifiers([...excludeIdentifiers, val]);
      setCustomInput("");
      setResult(null);
    }
  };

  const handleRemoveIdentifier = (ident: string) => {
    setExcludeIdentifiers(excludeIdentifiers.filter((i) => i !== ident));
    setResult(null);
  };

  const handleResetExclusions = () => {
    setExcludeIdentifiers([]);
    setExcludeSources([]);
    setResult(null);
    setError("");
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setError("");
    try {
      const payload: WhatIfRequest = {
        excludeIdentifiers: excludeIdentifiers.length > 0 ? excludeIdentifiers : undefined,
        excludeSources: excludeSources.length > 0 ? excludeSources : undefined,
      };
      const res = await api<WhatIfResponse>("/investigation/what-if", payload);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute counterfactual simulation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Canonical State Assurance Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-900">
              Safe In-Memory Simulation Sandbox
            </h4>
            <p className="text-xs text-emerald-700">
              Counterfactual analysis runs entirely in transient memory. The canonical PostgreSQL database graph is strictly protected and never modified.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 font-mono text-[11px] font-semibold rounded-md uppercase">
          CANONICAL_GRAPH_UNCHANGED=true
        </span>
      </div>

      {/* Configuration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preset Scenarios */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
            <Info size={14} className="text-emerald-600" />
            Investigative Test Scenarios
          </div>
          <div className="space-y-2.5">
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyPreset(p)}
                className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition group"
              >
                <div className="font-semibold text-xs text-slate-800 group-hover:text-emerald-900">
                  {p.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {p.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Exclusion Builder */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-slate-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Evidence Exclusion Parameter Builder
              </h3>
            </div>
            <button
              onClick={handleResetExclusions}
              className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition"
            >
              <RotateCcw size={12} />
              Reset All
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Specify phone numbers, bank accounts, suspect names, or source records to mathematically exclude from the reconstruction.
          </p>

          {/* Add input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. SYN-PHONE-061, SYN-ACCOUNT-001, Mira Solven..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddIdentifier()}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
            />
            <button
              onClick={handleAddIdentifier}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <Plus size={14} />
              Add Exclusion
            </button>
          </div>

          {/* Active Exclusion Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Currently Excluded From Reconstruction ({excludeIdentifiers.length}):
            </span>
            <div className="flex flex-wrap gap-2 min-h-[36px] p-2 bg-slate-50 border border-slate-200 rounded-lg">
              {excludeIdentifiers.length > 0 ? (
                excludeIdentifiers.map((ident) => (
                  <span
                    key={ident}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 rounded-md text-xs font-mono font-medium"
                  >
                    {ident}
                    <button
                      onClick={() => handleRemoveIdentifier(ident)}
                      className="hover:text-red-900"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">
                  No exclusions selected. Reconstructing entire canonical network.
                </span>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleRunSimulation}
              disabled={loading || excludeIdentifiers.length === 0}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition"
            >
              <Play size={14} />
              {loading ? "Recomputing Simulated Topology..." : "Run What-If Simulation"}
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          <strong>Simulation Error:</strong> {error}
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                Simulation Complete
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                Counterfactual Analytical Impact
              </h3>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Excluded Items: <strong>{result.excludedCount}</strong>
            </div>
          </div>

          {/* Metric Comparison Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-red-600">
                -{result.delta.removedNodes.length}
              </div>
              <div className="text-xs font-medium text-slate-600 mt-1">
                Entities Removed
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Isolated or severed nodes
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-red-600">
                -{result.delta.removedEdges.length}
              </div>
              <div className="text-xs font-medium text-slate-600 mt-1">
                Relationships Dissolved
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Communications & flows broken
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-amber-600">
                {result.delta.affectedAlerts.length}
              </div>
              <div className="text-xs font-medium text-slate-600 mt-1">
                Alert Patterns Altered
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                R1–R7 alerts mitigated
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-emerald-600">
                100%
              </div>
              <div className="text-xs font-medium text-slate-600 mt-1">
                Database Unaltered
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Pure in-memory simulation
              </div>
            </div>
          </div>

          {/* Narrative Summary */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Forensic Synthesis
            </h4>
            <p className="text-xs text-slate-800 leading-relaxed">
              {result.summary}
            </p>
          </div>

          {/* Detailed Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Removed Entities */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Entities Removed From Network ({result.delta.removedNodes.length})
              </span>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 text-xs bg-slate-50/50">
                {result.delta.removedNodes.length > 0 ? (
                  result.delta.removedNodes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onSelectEntity?.(n.id)}
                      className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded text-slate-800 cursor-pointer hover:bg-slate-100 transition"
                    >
                      <span className="font-medium">{n.label}</span>
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] rounded uppercase">
                        {n.type}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic p-2">
                    No nodes were completely severed from the network.
                  </p>
                )}
              </div>
            </div>

            {/* Affected Alerts / Connectivity */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Topology & Alert Impact ({result.delta.connectivityChanges.length + result.delta.affectedAlerts.length})
              </span>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 text-xs bg-slate-50/50">
                {result.delta.affectedAlerts.map((a, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs"
                  >
                    <strong>Alert Mitigated:</strong> {a.ruleId} — {a.explanation}
                  </div>
                ))}
                {result.delta.connectivityChanges.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-white border border-slate-200 rounded text-slate-700 text-xs flex items-center gap-1.5"
                  >
                    <Network size={12} className="text-slate-400 flex-shrink-0" />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
