import { useState, useEffect } from "react";
import {
  Radio,
  Clock,
  Network,
  AlertTriangle,
  TrendingUp,
  GitMerge,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { api } from "./types";
import type { NetworkChangesResponse } from "./types";

interface Props {
  onSelectEntity?: (label: string) => void;
}

export default function NetworkChangeRadar({ onSelectEntity }: Props) {
  const [data, setData] = useState<NetworkChangesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadChanges();
  }, []);

  const loadChanges = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api<NetworkChangesResponse>("/analysis/changes");
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load network changes");
    } finally {
      setLoading(false);
    }
  };

  const getShiftBadge = (type: string) => {
    switch (type) {
      case "BRIDGE_FORMED":
        return { label: "Cross-Case Bridge Formed", icon: GitMerge, color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
      case "ALERT_TRIGGERED":
        return { label: "Analytical Alert Triggered", icon: ShieldAlert, color: "bg-red-100 text-red-800 border-red-300" };
      case "CENTRALITY_SPIKE":
        return { label: "Hub Centrality Spike", icon: TrendingUp, color: "bg-cyan-100 text-cyan-800 border-cyan-300" };
      case "FINANCIAL_FLOW":
        return { label: "Financial Layering Pattern", icon: Layers, color: "bg-indigo-100 text-indigo-800 border-indigo-300" };
      case "ANOMALY_DETECTED":
        return { label: "Decoy / Anomaly Detected", icon: AlertTriangle, color: "bg-amber-100 text-amber-800 border-amber-300" };
      default:
        return { label: type, icon: Network, color: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs font-semibold rounded-full uppercase tracking-wider flex items-center gap-1">
                <Radio size={12} className="text-cyan-600 animate-pulse" />
                Evidence Delta Detection
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Historical Milestones
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">
              Network Change Radar: Impact of Ingested Records
            </h2>
            <p className="text-xs text-slate-500">
              Tracks how topological structure, graph centrality, community clusters, and analytical alerts mutated each time new evidence entered the system.
            </p>
          </div>

          {data && (
            <div className="flex items-center gap-3">
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div className="text-base font-bold text-slate-800">
                  {data.totalChanges}
                </div>
                <div className="text-[10px] text-slate-500">Key Milestones</div>
              </div>
              <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <div className="text-base font-bold text-emerald-700">
                  {data.changes.filter((c) => c.severity === "HIGH").length}
                </div>
                <div className="text-[10px] text-emerald-800">High Impact</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Changes Timeline */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">
          Computing network topological transitions...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          {data?.changes.map((ch, idx) => {
            const b = getShiftBadge(ch.changeType);
            const Icon = b.icon;
            return (
              <div
                key={ch.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono font-semibold">
                      Milestone #{idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold border rounded-md flex items-center gap-1.5 ${b.color}`}
                    >
                      <Icon size={13} />
                      {b.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <Clock size={12} />
                    {ch.timestamp ? ch.timestamp.slice(0, 10) : "Ingestion"}
                  </div>
                </div>

                {/* Trigger & Narrative */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {ch.trigger}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {ch.summary}
                  </p>
                </div>

                {/* State Diff comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Previous Graph State:
                    </span>
                    <p className="text-slate-700 font-mono text-[11px]">
                      {ch.previousState}
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs space-y-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      New Graph State After Ingestion:
                    </span>
                    <p className="text-emerald-950 font-mono text-[11px] font-medium">
                      {ch.newState}
                    </p>
                  </div>
                </div>

                {/* Affected Entities */}
                {ch.affectedEntities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Key Impacted Entities:
                    </span>
                    {ch.affectedEntities.map((ent) => (
                      <button
                        key={ent}
                        onClick={() => onSelectEntity?.(ent)}
                        className="px-2 py-0.5 bg-slate-100 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 rounded text-xs transition"
                      >
                        {ent}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
