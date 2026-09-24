import { useState } from "react";
import {
  RotateCcw,
  GitBranch,
  AlertTriangle,
  Waypoints,
  HelpCircle,
  Radio,
  ShieldCheck,
  Compass,
} from "lucide-react";
import type { Graph, Session } from "./types";
import InvestigationReplay from "./InvestigationReplay";
import CounterfactualAnalysis from "./CounterfactualAnalysis";
import ContradictionPanel from "./ContradictionPanel";
import EvidenceTrail from "./EvidenceTrail";
import InvestigationGaps from "./InvestigationGaps";
import NetworkChangeRadar from "./NetworkChangeRadar";

interface Props {
  graph: Graph;
  session: Session;
  onSelectEntity?: (id: string) => void;
  defaultTab?: "replay" | "what-if" | "contradictions" | "trail" | "gaps" | "radar";
  onLaunchReplayOnCanvas?: (data?: any) => void;
  onLaunchWhatIfOnCanvas?: (whatIfResponse: any) => void;
  onLaunchEvidencePathOnCanvas?: (trail: any) => void;
}

export default function InvestigationIntelligence({
  graph,
  session,
  onSelectEntity,
  defaultTab = "replay",
  onLaunchReplayOnCanvas,
  onLaunchWhatIfOnCanvas,
  onLaunchEvidencePathOnCanvas,
}: Props) {
  const [tab, setTab] = useState<
    "replay" | "what-if" | "contradictions" | "trail" | "gaps" | "radar"
  >(defaultTab);

  const tabs = [
    {
      id: "replay" as const,
      label: "Investigation Replay",
      icon: RotateCcw,
      badge: "Scrubber",
      desc: "Chronological evolution of the network as evidence arrived.",
    },
    {
      id: "what-if" as const,
      label: "Counterfactual / What-If",
      icon: GitBranch,
      badge: "Safe Sandbox",
      desc: "Simulate excluding questionable sources or identifiers.",
    },
    {
      id: "contradictions" as const,
      label: "Contradiction Engine",
      icon: AlertTriangle,
      badge: "Rules C1–C6",
      desc: "Detect factual discrepancies, impossible travel, and role conflicts.",
    },
    {
      id: "trail" as const,
      label: "Evidence Trail Mode",
      icon: Waypoints,
      badge: "Provenance",
      desc: "Multi-hop explainability paths with document quote citations.",
    },
    {
      id: "gaps" as const,
      label: "Investigation Gaps",
      icon: HelpCircle,
      badge: "Next Steps",
      desc: "Identify unresolved identifiers, dead-end leads, and blind spots.",
    },
    {
      id: "radar" as const,
      label: "Network Change Radar",
      icon: Radio,
      badge: "Milestones",
      desc: "Surfaces structural mutations and alert triggers across evidence batches.",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Title & Vision Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Compass size={13} className="text-emerald-700" />
              Explainable & Evidence-Linked
            </span>
            <span className="text-xs text-slate-400">
              NEXUS Intelligence Suite
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Investigation Intelligence Workbench
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Transparent, non-hallucinatory intelligence explaining how the criminal network evolved, why entities connect, what changes if evidence is excluded, and where records contradict.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-slate-600">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Assists investigators. Does not automate verdicts.</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between h-24 ${
                active
                  ? "bg-slate-900 text-white border-slate-900 shadow-md"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon
                  size={18}
                  className={active ? "text-emerald-400" : "text-slate-500"}
                />
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    active
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t.badge}
                </span>
              </div>
              <div>
                <div className="font-bold text-xs leading-tight">{t.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Subtab Content */}
      <div className="mt-4">
        {tab === "replay" && (
          <InvestigationReplay
            onSelectEntity={onSelectEntity}
            onLaunchReplayOnCanvas={onLaunchReplayOnCanvas}
          />
        )}
        {tab === "what-if" && (
          <CounterfactualAnalysis
            onSelectEntity={onSelectEntity}
            onLaunchWhatIfOnCanvas={onLaunchWhatIfOnCanvas}
          />
        )}
        {tab === "contradictions" && (
          <ContradictionPanel session={session} onSelectEntity={onSelectEntity} />
        )}
        {tab === "trail" && (
          <EvidenceTrail
            graph={graph}
            onSelectEntity={onSelectEntity}
            onLaunchEvidencePathOnCanvas={onLaunchEvidencePathOnCanvas}
          />
        )}
        {tab === "gaps" && (
          <InvestigationGaps onSelectEntity={onSelectEntity} />
        )}
        {tab === "radar" && (
          <NetworkChangeRadar onSelectEntity={onSelectEntity} />
        )}
      </div>
    </div>
  );
}
