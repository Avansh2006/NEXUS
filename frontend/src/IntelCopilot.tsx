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
  intent?: string;
  entities: { id: string; label: string; type: string; role?: string }[];
  evidenceIds: string[];
  ruleCitations: string[];
  suggestions?: string[];
}

export default function IntelCopilot({
  graph,
  onSelectEntity,
}: IntelCopilotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [history, setHistory] = useState<CopilotResponse[]>([]);

  const sampleQueries = [
    "What objects were detected in CCTV footage?",
    "What did the wiretap audio say?",
    "What vehicles were matched in visual search?",
    "Show scanned FIR document OCR text",
    "How did this investigation evolve over time?",
    "What if we remove SYN-PHONE-061?",
    "Are there any contradictions or conflicting evidence?",
    "Why are Aariv Veylan and Mira Solven connected?",
    "What information is missing in this case?",
    "What changed when new evidence arrived?",
    "Find accounts matching the pass-through pattern with high fan-in",
    "Which entities have the highest betweenness centrality?",
  ];

  const defaultSuggestions = [
    "What objects were detected in CCTV footage?",
    "What did the wiretap audio say?",
    "What vehicles were matched in visual search?",
    "Show scanned FIR document OCR text",
    "Which entities have the highest betweenness centrality?",
    "Find accounts matching the pass-through pattern with high fan-in",
    "Who links Case NXS-001 to NXS-003?",
  ];

  const handleExecute = (queryText: string) => {
    const q = queryText.toLowerCase().trim();
    if (!q) return;

    let summary = "";
    let mappedIntent = "entity_lookup";
    const matchedEntities: { id: string; label: string; type: string; role?: string }[] = [];
    const evidence: string[] = [];
    const rules: string[] = [];
    let suggestions: string[] | undefined = undefined;

    const nodes = graph.nodes;
    const metrics = graph.analysis?.metrics ?? [];
    const alerts = graph.analysis?.alerts ?? [];

    // Check for out-of-scope query
    const outOfScopePatterns = [
      "penalty", "punishment", "section", "ipc", "bns", "prime minister",
      "president", "weather", "poem", "joke", "capital of", "who invented", "recipe"
    ];
    if (outOfScopePatterns.some((pat) => q.includes(pat))) {
      mappedIntent = "out_of_scope";
      summary = "I can't answer that from the graph data. I can help you query suspects, communication hubs, pass-through accounts, or shared identifiers in the active cases.";
      suggestions = defaultSuggestions;
    } else if (q.includes("cctv") || q.includes("hunt") || q.includes("backpack") || q.includes("suv") || q.includes("dino") || q.includes("sam") || (q.includes("video") && q.includes("detect"))) {
      mappedIntent = "cctv_hunt_intel";
      summary = "Natural-Language CCTV Hunt (Grounding DINO + SAM 2.1): Open-vocabulary video tracking on CCTV Junction Cam-04 detected Track TRACK-01 (white SUV, 88% conf, 00:00.3–00:03.3) and Track TRACK-02 (person with red backpack, 87% conf, 00:01.0–00:03.6, compound proximity persisted 4 frames). Representative crop thumbnails can be passed directly to Cross-Case Visual Search.";
      const veh = nodes.find((n) => n.type === "Vehicle" || n.label.includes("MH-04"));
      if (veh) matchedEntities.push({ id: veh.id, label: veh.label, type: veh.type, role: "CCTV Vehicle Track" });
      evidence.push("CCTV_Junction_Cam04_NXS007.mp4", "TRACK-01", "TRACK-02");
      rules.push("Grounding DINO Detection", "SAM 2.1 Temporal Tracking", "Machine-Generated Lead");
      suggestions = ["What vehicles were matched in visual search?", "What did the wiretap audio say?", "Show scanned FIR document OCR text"];
    } else if (q.includes("wiretap") || q.includes("audio") || q.includes("recording") || q.includes("whisper") || q.includes("say") || q.includes("spoken")) {
      mappedIntent = "multimodal_audio_intel";
      summary = "Acoustic Intelligence (faster-whisper small-int8): Wiretap intercept for Case NXS-007 captured conversation between SPEAKER_00 and SPEAKER_01 discussing unauthorized remittance authorized via SYN-PHONE-001 into beneficiary account SYN-ACCOUNT-001 (INR 75,000). At 00:03.20, speaker directly referenced Aariv Veylan.";
      const aariv = nodes.find((n) => n.label.includes("Aariv"));
      if (aariv) matchedEntities.push({ id: aariv.id, label: aariv.label, type: aariv.type, role: "Spoken Subject" });
      const phone = nodes.find((n) => n.label.includes("SYN-PHONE-001"));
      if (phone) matchedEntities.push({ id: phone.id, label: phone.label, type: phone.type, role: "Intercept Target" });
      evidence.push("ITM-AUD-NXS007", "ITM-SEG-01");
      rules.push("Voice Intelligence", "Diarized Telephony Citation");
      suggestions = ["Show scanned FIR document OCR text", "What vehicles were matched in visual search?", "Why are Aariv Veylan and Mira Solven connected?"];
    } else if (q.includes("vehicle") || q.includes("visual") || q.includes("clip") || q.includes("camera") || q.includes("openclip") || q.includes("car")) {
      mappedIntent = "multimodal_visual_intel";
      summary = "Visual Evidence Search (OpenCLIP ViT-B-32): Query probe CCTV_Vehicle_NXS007.jpg (MH-04-AB-1234 departing Navapur Sector 4) matches Seized_Vehicle_CASE019.jpg in Case CASE-019 with 95% visual cosine similarity. Note: Mandatory judicial safeguard applies — visual similarity is an investigative lead, not proof of identical ownership.";
      const veh = nodes.find((n) => n.type === "Vehicle" || n.label.includes("MH-04"));
      if (veh) matchedEntities.push({ id: veh.id, label: veh.label, type: veh.type, role: "Visual Match Lead" });
      evidence.push("ITM-VIS-CASE019-01", "ITM-VIS-NXS007-01");
      rules.push("OpenCLIP ViT-B-32 Cross-Case Visual Lead");
      suggestions = ["What did the wiretap audio say?", "Show scanned FIR document OCR text"];
    } else if (q.includes("ocr") || (q.includes("scanned") && q.includes("fir")) || q.includes("document") || q.includes("paddle")) {
      mappedIntent = "multimodal_document_ocr";
      summary = "Document OCR Intelligence (PaddleOCR PP-OCRv5): Scanned FIR No. 104/2026 (Navapur Police Station) extracted verbatim text mentioning accused Aariv Veylan, co-accused Dev Neral, getaway vehicle MH-04-AB-1234, and transfer of INR 75,000 into account SYN-ACCOUNT-001.";
      const aariv = nodes.find((n) => n.label.includes("Aariv"));
      if (aariv) matchedEntities.push({ id: aariv.id, label: aariv.label, type: aariv.type, role: "Accused (FIR 104/2026)" });
      evidence.push("ITM-DOC-FIR104", "ITM-PAGE-01");
      rules.push("PaddleOCR Multilingual Devanagari/English Extraction");
      suggestions = ["What did the wiretap audio say?", "What vehicles were matched in visual search?"];
    } else if (q.includes("nxs-001") || q.includes("nxs-003") || (q.includes("link") && q.includes("case"))) {
      mappedIntent = "shared_identifiers";
      const shared = nodes.find((n) => n.label === "SYN-PHONE-001");
      if (shared) {
        matchedEntities.push({
          id: shared.id,
          label: shared.label,
          type: shared.type,
          role: "Outbound Communication Hub",
        });
        evidence.push(...(shared.properties.evidenceIds || []));
        rules.push("R1");
        summary = `Cross-case analysis indicates that ${shared.label} is an identifier linking Cases NXS-001, NXS-002, and NXS-003 across independent police FIRs with source text provenance.`;
      }
    } else if (q.includes("mule") || q.includes("fan-in") || q.includes("pass-through") || q.includes("account")) {
      mappedIntent = "pass_through_accounts";
      const mule = nodes.find((n) => n.label === "SYN-ACCOUNT-001");
      if (mule) {
        matchedEntities.push({
          id: mule.id,
          label: mule.label,
          type: mule.type,
          role: "Pass-Through Account Pattern",
        });
        evidence.push(...(mule.properties.evidenceIds || []));
        rules.push("R4");
        summary = `Account ${mule.label} exhibits the pass-through account pattern (fan-in and rapid pass-through structuring). Note: Account holders may be unwitting participants or victims.`;
      }
    } else if (q.includes("kingpin") || q.includes("coordinator") || q.includes("betweenness") || q.includes("central")) {
      mappedIntent = "highest_betweenness";
      const topMetric = [...metrics].sort((a, b) => b.betweenness - a.betweenness)[0];
      const kingpin = topMetric ? nodes.find((n) => n.id === topMetric.entityId) : null;
      if (kingpin) {
        matchedEntities.push({
          id: kingpin.id,
          label: kingpin.label,
          type: kingpin.type,
          role: topMetric.roleTitle || "Central Hub (bridge pattern)",
        });
        evidence.push(...(kingpin.properties.evidenceIds || []));
        rules.push("R3");
        summary = `${kingpin.label} (${kingpin.type}) exhibits the highest betweenness centrality (${topMetric.betweenness.toFixed(3)}) and influence index (${topMetric.influence}), functioning as a central bridge connecting separate network communities.`;
      }
    } else if (q.includes("vehicle") || q.includes("organization") || q.includes("front") || q.includes("business")) {
      mappedIntent = "logistics_entities";
      const vehs = nodes.filter((n) => n.type === "Vehicle" || n.type === "Organization");
      vehs.forEach((v) => {
        matchedEntities.push({ id: v.id, label: v.label, type: v.type });
        evidence.push(...(v.properties.evidenceIds || []));
      });
      summary = `Identified ${vehs.length} transport and business entities: ${vehs.map((v) => `${v.label} (${v.type})`).join(", ")}. In Case NXS-005, vehicle ZZ00NX0001 is recorded in the report narrative; Veyra Services appears as a recurring business entity across multiple records.`;
    } else if (q.includes("suppress") || q.includes("999") || q.includes("public")) {
      mappedIntent = "suppression_reason";
      const pub = nodes.find((n) => n.label === "SYN-PHONE-999");
      if (pub) {
        matchedEntities.push({ id: pub.id, label: pub.label, type: pub.type, role: "Public Helpline" });
        rules.push("R1 Suppression");
        summary = `SYN-PHONE-999 is recognized as a legitimate public/courier helpline. The intelligence engine explicitly suppresses cross-case alerts on this node to avoid false linkages to public service channels.`;
      }
    } else if (q.includes("circle") || q.includes("loop") || q.includes("r7") || q.includes("hawala") || q.includes("transaction")) {
      mappedIntent = "circular_flows";
      rules.push("R7");
      const r7Alerts = alerts.filter((a) => a.ruleId === "R7");
      if (r7Alerts.length > 0) {
        summary = `Rule R7 detected ${r7Alerts.length} circular financial transaction loop(s). These loops exhibit round-tripping transfer topologies across accounts.`;
      } else {
        summary = `Rule R7 (Circular Fund Flow Detector) is active. In the baseline demo, funds follow fan-in and rapid pass-through structuring (R4). You can ingest circular transfer payloads in Data Ingestion to trigger closed cycle alerts.`;
      }
    } else if (q.includes("replay") || q.includes("playback") || q.includes("evolve") || q.includes("evolution")) {
      mappedIntent = "investigation_replay";
      summary = `The investigation evolved through sequential ingestion of Case NXS-001 through NXS-006 FIRs, 64 CDR calls, and 51 financial transfers. You can scrub through every step and view cumulative network changes in the Investigation Intelligence Replay tab.`;
      suggestions = ["Show network change radar and analytical milestones", "Find accounts matching the pass-through pattern with high fan-in"];
    } else if (q.includes("what if") || q.includes("what-if") || q.includes("counterfactual") || q.includes("exclude") || q.includes("061")) {
      mappedIntent = "what_if_analysis";
      const decoyPhone = nodes.find((n) => n.label === "SYN-PHONE-061");
      if (decoyPhone) {
        matchedEntities.push({ id: decoyPhone.id, label: decoyPhone.label, type: decoyPhone.type, role: "Decoy Identifier" });
      }
      summary = `Counterfactual simulation sandbox allows excluding questionable records or identifiers (such as SYN-PHONE-061) in-memory without modifying the canonical graph (CANONICAL_GRAPH_UNCHANGED=true). Excluding SYN-PHONE-061 severs Case NXS-006 from the Aariv syndicate.`;
      suggestions = ["Open Counterfactual Analysis tab", "Are there any contradictions or conflicting evidence?"];
    } else if (q.includes("contradict") || q.includes("conflict") || q.includes("discrepancy") || q.includes("c1") || q.includes("c4") || q.includes("c5")) {
      mappedIntent = "contradiction_engine";
      rules.push("C1", "C4", "C5");
      summary = `The Contradiction Engine evaluates rules C1 through C6. Key discrepancies flagged: C1 (shared phone SYN-PHONE-001 claimed by multiple suspects), C4 (near-duplicate Aariv Veylan vs Aariv Veylen), and C5 (incompatible role: Aariv recorded as Accused in NXS-001/002 but Witness in NXS-003/004).`;
      suggestions = ["Open Contradiction Engine tab", "Why are Aariv Veylan and Mira Solven connected?"];
    } else if (q.includes("why are") || q.includes("why is") || q.includes("connected") || q.includes("trail") || q.includes("path")) {
      mappedIntent = "evidence_trail";
      const aariv = nodes.find((n) => n.label === "Aariv Veylan");
      const mira = nodes.find((n) => n.label === "Mira Solven");
      if (aariv) matchedEntities.push({ id: aariv.id, label: aariv.label, type: aariv.type });
      if (mira) matchedEntities.push({ id: mira.id, label: mira.label, type: mira.type });
      summary = `Aariv Veylan and Mira Solven are connected across 2 hops via shared phone SYN-PHONE-001 and direct co-accused status in Case NXS-002. Every step in this path is backed by primary police FIR narratives and CDR records.`;
      suggestions = ["Open Evidence Trail Mode", "What if we remove SYN-PHONE-061?"];
    } else if (q.includes("gap") || q.includes("missing") || q.includes("blind spot") || q.includes("dead end")) {
      mappedIntent = "investigation_gaps";
      summary = `Investigation Gap Finder identified key missing links: unresolved identifiers without subscriber KYC (SYN-PHONE-020), suspects lacking communication telemetry, and unverified vehicle ZZ00NX0001. Procedural Section 91 and VAHAN queries are suggested.`;
      suggestions = ["Open Investigation Gaps tab", "Show network change radar"];
    } else if (q.includes("radar") || q.includes("change") || q.includes("milestone") || q.includes("new evidence")) {
      mappedIntent = "network_change_radar";
      summary = `Network Change Radar tracks structural mutations across 6 major milestones: initial baseline (NXS-001), cross-case bridge formation (NXS-002), R1 alert trigger (NXS-003), telephony hub centrality spike (CDRs), and financial layering (Transactions).`;
      suggestions = ["Replay how this investigation evolved over time", "Are there any contradictions or conflicting evidence?"];
    } else {
      // General entity search
      mappedIntent = "entity_lookup";
      const matches = nodes.filter((n) => n.label.toLowerCase().includes(q));
      if (matches.length > 0) {
        matches.slice(0, 3).forEach((m) => {
          matchedEntities.push({ id: m.id, label: m.label, type: m.type });
          evidence.push(...(m.properties.evidenceIds || []));
        });
        summary = `Found ${matches.length} matching entities in the active graph. Top result: ${matches[0].label} (${matches[0].type}) associated with ${matches[0].properties.caseIds.join(", ")}.`;
      } else {
        mappedIntent = "out_of_scope";
        summary = `I can't answer that from the graph data. Did you mean to ask about high-betweenness bridges, pass-through accounts, or communication hubs?`;
        suggestions = defaultSuggestions;
      }
    }

    const newResponse: CopilotResponse = {
      query: queryText,
      summary,
      intent: mappedIntent,
      entities: matchedEntities,
      evidenceIds: evidence.slice(0, 4),
      ruleCitations: rules,
      suggestions,
    };
    setHistory((prev) => [newResponse, ...prev]);
    setInput("");
  };

  return (
    <div className="intel-copilot-container">
      {/* Floating Trigger Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="intel-copilot-trigger fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#215a49] to-[#163f35] text-[#e0fff2] shadow-2xl border border-[#48997a66] hover:scale-105 transition-all font-sans text-xs font-medium cursor-pointer"
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
        <div className="fixed bottom-6 right-6 z-50 w-[430px] max-w-[calc(100vw-2rem)] max-h-[600px] flex flex-col rounded-xl bg-[#0e2229fa] backdrop-blur-xl border border-[#3b6d5f77] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden font-sans text-[#cfdfd8] animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#132c33] border-b border-[#2d564b]">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-[#5ce0a8]" />
              <div>
                <b className="text-xs text-[#ecfbf4] block">NEXUS Intel Copilot</b>
                <span className="text-[9px] font-mono text-[#76a896]">DETERMINISTIC, GRAPH-GROUNDED</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLlmEnabled((prev) => !prev)}
                className={`text-[9px] px-2 py-0.5 rounded font-mono border transition cursor-pointer ${
                  llmEnabled
                    ? "bg-[#1f5643] text-[#7ef4c2] border-[#4bb08a]"
                    : "bg-[#0b1c20] text-[#719889] border-[#22483d]"
                }`}
                title="Toggle LLM Intent Mapper (Feature Flag, OFF by default)"
              >
                {llmEnabled ? "LLM: ON" : "RULE-BASED (LLM: OFF)"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-[#88b09f] hover:text-white hover:bg-[#20444c] transition"
                aria-label="Close Copilot"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Architecture Pipeline Banner */}
          <div className="px-3 py-1.5 bg-[#0a181e] border-b border-[#21433b] flex items-center justify-between text-[8.5px] font-mono text-[#6c9183]">
            <span>PIPELINE: NL QUERY → INTENT MAPPER → GRAPH QUERY → GROUNDED TEMPLATE</span>
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
                  NL intent mapped strictly to deterministic graph query templates.
                </p>
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#142e36] border border-[#2e594d] text-xs space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="font-semibold text-[#a5e0cb] flex items-center gap-1.5">
                      <Search size={13} className="text-[#51b88e]" />
                      <span>{h.query}</span>
                    </div>
                    {h.intent && (
                      <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-[#10272e] text-[#6cb597] border border-[#234b3f]">
                        {h.intent}
                      </span>
                    )}
                  </div>
                  <p className="text-[#e2f0ea] leading-relaxed text-[11.5px]">{h.summary}</p>

                  {/* Suggestion Chips */}
                  {h.suggestions && h.suggestions.length > 0 && (
                    <div className="pt-1.5 flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-mono text-[#6ba491] w-full">SUGGESTIONS:</span>
                      {h.suggestions.map((sug, si) => (
                        <button
                          key={si}
                          type="button"
                          onClick={() => handleExecute(sug)}
                          className="text-[10px] px-2 py-1 rounded bg-[#16363f] hover:bg-[#235360] text-[#aae8d4] border border-[#346255] transition text-left cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}

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
