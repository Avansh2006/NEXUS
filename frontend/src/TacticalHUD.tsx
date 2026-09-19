import { Shield, Orbit, Network, Boxes, Zap } from "lucide-react";
import type { Graph } from "./types";

interface TacticalHUDProps {
  graph: Graph;
  viewMode: "2d" | "3d";
  onToggleView: (mode: "2d" | "3d") => void;
  analyzed: boolean;
  metaNodeView?: boolean;
  onToggleMetaNode?: () => void;
}

export default function TacticalHUD({
  graph,
  viewMode,
  onToggleView,
  analyzed,
  metaNodeView = false,
  onToggleMetaNode,
}: TacticalHUDProps) {
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  const telemetry = graph.analysis?.telemetry;

  return (
    <div className="tactical-hud flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0f242bc9] backdrop-blur-md border-b border-[#284f4755] text-xs font-mono">
      {/* Left: Engine Status & Telemetry */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#16363ecc] border border-[#3b6d5f44] text-[#86d8b3]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#52d69f] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#42c790]" />
          </span>
          <span className="font-semibold tracking-wider text-[10px]">
            {analyzed ? "RESOLVED INTELLIGENCE" : "SEEDED GRAPH"}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-[#7ca496] text-[11px]">
          <Shield size={13} className="text-[#51b88e]" />
          <span>DETERMINISTIC, GRAPH-GROUNDED ENGINE</span>
        </div>

        {telemetry ? (
          <span
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] ${
              telemetry.betweennessMode.startsWith("approximate")
                ? "bg-amber-950/60 border-amber-600/50 text-amber-300"
                : "bg-[#18392f] border-[#2e6b57] text-[#7de3be]"
            }`}
            title="Algorithm telemetry: exact vs sampled betweenness centrality"
          >
            <Zap size={11} />
            <span>Centrality: {telemetry.betweennessMode}</span>
          </span>
        ) : null}
      </div>

      {/* Center: Live Entity / Topology Stats */}
      <div className="flex items-center gap-2 text-[#8baea2] text-[11px]">
        <span className="px-2 py-0.5 rounded bg-[#16323a] border border-[#2b5046] text-[#bce8d4]">
          {nodeCount} Nodes
        </span>
        <span className="text-[#41685e]">/</span>
        <span className="px-2 py-0.5 rounded bg-[#16323a] border border-[#2b5046] text-[#bce8d4]">
          {edgeCount} Links
        </span>
        {graph.analysis?.counts?.casesLinked ? (
          <>
            <span className="text-[#41685e]">/</span>
            <span className="px-2 py-0.5 rounded bg-[#2c4731] border border-[#487a53] text-[#a4efb3]">
              {graph.analysis.counts.casesLinked} Linked Cases
            </span>
          </>
        ) : null}
      </div>

      {/* Right: View Mode & Meta-Node Switchers */}
      <div className="flex items-center gap-2">
        {onToggleMetaNode && graph.analyzed && (graph.analysis?.communities?.length ?? 0) > 0 ? (
          <button
            type="button"
            onClick={onToggleMetaNode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-sans font-medium transition-all border ${
              metaNodeView
                ? "bg-[#d97706] text-white border-amber-500 shadow-sm"
                : "bg-[#132c33] text-[#85a89b] border-[#335d52] hover:text-[#c4e3d7]"
            }`}
            aria-label="Toggle Community Meta-Node View"
            title="Collapse Louvain communities into single meta-nodes for scalable rendering"
          >
            <Boxes size={13} />
            <span>{metaNodeView ? "Meta-Nodes (On)" : "Meta-Node View"}</span>
          </button>
        ) : null}

        <div className="flex items-center bg-[#132c33] p-0.5 rounded-lg border border-[#335d52]">
          <button
            type="button"
            onClick={() => onToggleView("2d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-sans font-medium transition-all ${
              viewMode === "2d"
                ? "bg-[#2b6855] text-white shadow-sm"
                : "text-[#85a89b] hover:text-[#c4e3d7]"
            }`}
            aria-label="2D Network View"
          >
            <Network size={13} />
            <span>2D Graph</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleView("3d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-sans font-medium transition-all ${
              viewMode === "3d"
                ? "bg-[#2b6855] text-white shadow-sm"
                : "text-[#85a89b] hover:text-[#c4e3d7]"
            }`}
            aria-label="3D Tactical Holo Sphere"
          >
            <Orbit size={13} />
            <span>3D Holo Sphere</span>
          </button>
        </div>
      </div>
    </div>
  );
}
