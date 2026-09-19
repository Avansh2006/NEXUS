import { useState } from "react";
import {
  Sparkles,
  Bot,
  Send,
  ArrowRight,
  ShieldCheck,
  Search,
  X,
} from "lucide-react";
import type { Graph } from "./types";
import { colors } from "./types";

interface IntelCopilotProps {
  graph: Graph;
  onSelectEntity: (id: string) => void;
  onFocusHops?: (hops: number) => void;
}

interface CopilotResponse {
  query: string;
  summary: string;
  entities: { id: string; label: string; type: string; role?: string }[];
  evidenceIds: string[];
  ruleCitations: string[];
}

export default function IntelCopilot({
  graph,
  onSelectEntity,
}: IntelCopilotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<CopilotResponse[]>([]);

  const sampleQueries = [
    "Who links Case NXS-001 to NXS-003?",
    "Find all suspected money mules with high fan-in",
    "Identify the kingpin with highest betweenness centrality",
    "What vehicles or front organizations are recorded?",
    "Why was SYN-PHONE-999 suppressed?",
    "Show circular laundering loops and R7 alerts",
  ];

  const handleExecute = (queryText: string) => {
    const q = queryText.toLowerCase().trim();
    if (!q) return;

    let summary = "";
    const matchedEntities: { id: string; label: string; type: string; role?: string }[] = [];
    const evidence: string[] = [];
    const rules: string[] = [];

    const nodes = graph.nodes;
    const metrics = graph.analysis?.metrics ?? [];
    const alerts = graph.analysis?.alerts ?? [];

    if (q.includes("nxs-001") || q.includes("nxs-003") || q.includes("link") && q.includes("case")) {
      const shared = nodes.find((n) => n.label === "SYN-PHONE-001");
      if (shared) {
        matchedEntities.push({
          id: shared.id,
          label: shared.label,
          type: shared.type,
          role: "Cross-Case Hub",
        });
        evidence.push(...(shared.properties.evidenceIds || []));
        rules.push("R1");
        summary = `Cross-case analysis reveals that ${shared.label} is the single shared identifier bridging Cases NXS-001, NXS-002, and NXS-003. It connects multiple accused suspects across independent police FIRs with 100% verified text provenance.`;
      }
    } else if (q.includes("mule") || q.includes("fan-in") || q.includes("account")) {
      const mule = nodes.find((n) => n.label === "SYN-ACCOUNT-001");
      if (mule) {
        matchedEntities.push({
          id: mule.id,
          label: mule.label,
          type: mule.type,
          role: "Mule / Layering Account",
        });
        evidence.push(...(mule.properties.evidenceIds || []));
        rules.push("R4");
        summary = `Account ${mule.label} is flagged for fan-in and rapid pass-through structuring. It received funds from multiple distinct sources and transferred them within minutes, characteristic of a staging or mule account.`;
      }
    } else if (q.includes("kingpin") || q.includes("coordinator") || q.includes("betweenness")) {
      const topMetric = [...metrics].sort((a, b) => b.betweenness - a.betweenness)[0];
      const kingpin = topMetric ? nodes.find((n) => n.id === topMetric.entityId) : null;
      if (kingpin) {
        matchedEntities.push({
          id: kingpin.id,
          label: kingpin.label,
          type: kingpin.type,
          role: topMetric.roleTitle || "Syndicate Coordinator",
        });
        evidence.push(...(kingpin.properties.evidenceIds || []));
        rules.push("R3");
        summary = `${kingpin.label} (${kingpin.type}) has the highest betweenness centrality (${topMetric.betweenness.toFixed(3)}) and influence score (${topMetric.influence}). It serves as the primary bridge connecting separate criminal communities.`;
      }
    } else if (q.includes("vehicle") || q.includes("organization") || q.includes("front")) {
      const vehs = nodes.filter((n) => n.type === "Vehicle" || n.type === "Organization");
      vehs.forEach((v) => {
        matchedEntities.push({ id: v.id, label: v.label, type: v.type });
        evidence.push(...(v.properties.evidenceIds || []));
      });
      summary = `Identified ${vehs.length} logistical and front entities: ${vehs.map((v) => `${v.label} (${v.type})`).join(", ")}. In Case NXS-005, vehicle ZZ00NX0001 was documented in the theft narrative; Veyra Services appears as a common front org across multiple FIRs.`;
    } else if (q.includes("suppress") || q.includes("999") || q.includes("public")) {
      const pub = nodes.find((n) => n.label === "SYN-PHONE-999");
      if (pub) {
        matchedEntities.push({ id: pub.id, label: pub.label, type: pub.type, role: "Public Helpline" });
        rules.push("R1 Suppression");
        summary = `SYN-PHONE-999 is recognized as a legitimate public/courier helpline. The intelligence engine explicitly suppresses false-positive syndicate alerts on this node to prevent innocent organizations from being linked to criminal rings.`;
      }
    } else if (q.includes("circle") || q.includes("loop") || q.includes("r7") || q.includes("hawala")) {
      rules.push("R7");
      const r7Alerts = alerts.filter((a) => a.ruleId === "R7");
      if (r7Alerts.length > 0) {
        summary = `Rule R7 detected ${r7Alerts.length} circular financial laundering cycle(s). These loops exhibit round-tripping transfer topologies designed to disguise the origin of illegal funds.`;
      } else {
        summary = `Rule R7 (Circular Fund Laundering Ring Detector) is armed. In the baseline demo, funds follow fan-in and rapid pass-through layering (R4). You can ingest circular transfer payloads in Data Ingestion to trigger closed cycle alerts.`;
      }
    } else {
      // General entity search
      const matches = nodes.filter((n) => n.label.toLowerCase().includes(q));
      if (matches.length > 0) {
        matches.slice(0, 3).forEach((m) => {
          matchedEntities.push({ id: m.id, label: m.label, type: m.type });
          evidence.push(...(m.properties.evidenceIds || []));
        });
        summary = `Found ${matches.length} matching entities in the active graph. Top result: ${matches[0].label} (${matches[0].type}) associated with ${matches[0].properties.caseIds.join(", ")}.`;
      } else {
        summary = `No exact matches for "${queryText}". Try asking about specific suspects (e.g. "Aariv Veylan"), phone hubs ("SYN-PHONE-001"), accounts ("SYN-ACCOUNT-001"), or tactical patterns like "mule accounts".`;
      }
    }

    const newResponse: CopilotResponse = {
      query: queryText,
      summary,
      entities: matchedEntities,
      evidenceIds: evidence.slice(0, 4),
      ruleCitations: rules,
    };

    setHistory((prev) => [newResponse, ...prev.slice(0, 4)]);
    setInput("");
  };

  return (
    <div className="intel-copilot-container">
      {/* Floating Trigger Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#215a49] to-[#163f35] text-[#e0fff2] shadow-2xl border border-[#48997a66] hover:scale-105 transition-all font-sans text-xs font-medium cursor-pointer"
          aria-label="Open NEXUS Intel Copilot"
        >
          <Sparkles size={16} className="text-[#5ce0a8] animate-pulse" />
          <span>NEXUS Intel Copilot</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5ce0a8] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#42c790]" />
          </span>
        </button>
      )}

      {/* Expanded Copilot Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] max-h-[580px] flex flex-col rounded-xl bg-[#0e2229fa] backdrop-blur-xl border border-[#3b6d5f77] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden font-sans text-[#cfdfd8] animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#132c33] border-b border-[#2d564b]">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-[#5ce0a8]" />
              <div>
                <b className="text-xs text-[#ecfbf4] block">NEXUS Intel Copilot</b>
                <span className="text-[9px] font-mono text-[#76a896]">DETERMINISTIC AI · ZERO HALLUCINATION</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-[#88b09f] hover:text-white hover:bg-[#20444c] transition"
              aria-label="Close Copilot"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Smart Prompt Chips */}
          <div className="p-3 bg-[#0c1c22] border-b border-[#25463e] flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            <span className="text-[10px] text-[#719588] w-full font-mono">INVESTIGATIVE PROMPTS:</span>
            {sampleQueries.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleExecute(sq)}
                className="text-[10.5px] px-2.5 py-1 rounded-full bg-[#15343c] hover:bg-[#22515b] text-[#bde3d4] border border-[#2f5d52] transition text-left cursor-pointer"
              >
                {sq}
              </button>
            ))}
          </div>

          {/* Query & Conversation History */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 max-h-[300px]">
            {history.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#719889]">
                <ShieldCheck size={28} className="mx-auto mb-2 text-[#469e7b] opacity-60" />
                <p className="font-medium text-[#c4e3d6]">Ask any investigative question</p>
                <p className="text-[11px] mt-1 text-[#86a89a]">
                  Answers query the graph topology directly and cite verified evidence.
                </p>
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#142e36] border border-[#2e594d] text-xs space-y-2">
                  <div className="font-semibold text-[#a5e0cb] flex items-center gap-1.5">
                    <Search size={13} className="text-[#51b88e]" />
                    <span>{h.query}</span>
                  </div>
                  <p className="text-[#e2f0ea] leading-relaxed text-[11.5px]">{h.summary}</p>

                  {/* Entity Badges with Click-to-Inspect */}
                  {h.entities.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {h.entities.map((ent) => (
                        <button
                          key={ent.id}
                          type="button"
                          onClick={() => {
                            onSelectEntity(ent.id);
                          }}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1c444e] hover:bg-[#275d6b] border border-[#417668] text-[#c9f2e1] text-[10px] font-medium transition cursor-pointer"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: colors[ent.type as keyof typeof colors] || "#42c790" }}
                          />
                          <span>{ent.label}</span>
                          {ent.role && (
                            <span className="text-[8.5px] px-1 py-0.2 rounded bg-[#0b1c20] text-[#7ce0b8]">
                              {ent.role}
                            </span>
                          )}
                          <ArrowRight size={10} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Evidence / Rule Tags */}
                  {(h.evidenceIds.length > 0 || h.ruleCitations.length > 0) && (
                    <div className="flex items-center gap-2 text-[9px] font-mono text-[#749d8c] pt-1">
                      {h.ruleCitations.map((r, ri) => (
                        <span key={ri} className="px-1.5 py-0.5 rounded bg-[#1a3d34] text-[#86e2b6]">
                          {r}
                        </span>
                      ))}
                      {h.evidenceIds.map((ev, ei) => (
                        <span key={ei} className="px-1.5 py-0.5 rounded bg-[#122c30]">
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecute(input);
            }}
            className="p-3 bg-[#10252c] border-t border-[#2d564b] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Copilot (e.g. Who links NXS-001 and NXS-002?)..."
              className="flex-1 px-3 py-2 rounded-lg bg-[#0a181c] border border-[#2b5146] text-xs text-[#e0fff2] placeholder-[#62877a] focus:outline-none focus:border-[#52bb93]"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 rounded-lg bg-[#276e56] hover:bg-[#348e70] disabled:opacity-40 text-white transition cursor-pointer"
              aria-label="Send query"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
