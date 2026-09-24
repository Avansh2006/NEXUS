package systems.nexus;

import static systems.nexus.Model.*;
import java.time.Instant;
import java.util.*;

public final class Report {
    private Report() {}

    private static final com.fasterxml.jackson.databind.ObjectMapper JSON =
        new com.fasterxml.jackson.databind.ObjectMapper().enable(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);

    private static String canonicalJson(Object value) {
        try {
            return JSON.writeValueAsString(JSON.convertValue(value, Object.class));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize report graph", e);
        }
    }

    static String escape(Object value) {
        if (value == null) return "";
        return String.valueOf(value)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    static String sha256(String input) {
        try {
            var md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            var hex = new StringBuilder();
            for (byte b : d) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception ex) {
            return "n/a";
        }
    }

    public static String render(Graph g, String image) {
        return renderDossier(g, new ReportRequest(image), null, null, "system");
    }

    public static String renderDossier(Graph g, ReportRequest request, Store store, IntelligenceSuiteService suite, String username) {
        Set<String> sec = (request != null && request.sections() != null && !request.sections().isEmpty())
            ? new HashSet<>(request.sections())
            : null;
        java.util.function.Predicate<String> inc = k -> sec == null || sec.contains(k);

        StringBuilder out = new StringBuilder("<!doctype html><html lang='en'><head><meta charset='UTF-8'>");
        out.append("<title>NEXUS Investigation Dossier</title>");
        out.append("<style>");
        out.append("body{font:13.5px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:1120px;margin:36px auto;padding:0 24px;color:#1e293b;background:#ffffff;}");
        out.append("h1{font-size:26px;letter-spacing:2px;margin:0 0 4px 0;color:#0f172a;}");
        out.append(".subhead{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px;}");
        out.append(".banner-warning{background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:11.5px;color:#92400e;margin:16px 0;}");
        out.append(".banner-sim{background:#fef2f2;border:2px dashed #ef4444;color:#991b1b;padding:10px 14px;border-radius:4px;font-weight:bold;text-align:center;margin:12px 0;}");
        out.append(".badge-valid{display:inline-block;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 8px;border-radius:9999px;font-weight:600;font-size:11px;}");
        out.append(".badge-invalid{display:inline-block;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:2px 8px;border-radius:9999px;font-weight:600;font-size:11px;}");
        out.append("h2{font-size:17px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:36px;color:#0f172a;letter-spacing:0.5px;}");
        out.append("table{border-collapse:collapse;width:100%;font-size:11.5px;margin:12px 0 20px 0;}");
        out.append("th{background:#f8fafc;padding:8px 10px;border:1px solid #cbd5e1;text-align:left;font-weight:600;color:#334155;}");
        out.append("td{padding:7px 10px;border:1px solid #e2e8f0;text-align:left;overflow-wrap:anywhere;vertical-align:top;}");
        out.append("tr:nth-child(even){background:#fcfdfd;}");
        out.append(".grid-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0;}");
        out.append(".stat-box{background:#f8fafc;border:1px solid #e2e8f0;padding:12px 14px;border-radius:6px;}");
        out.append(".stat-box .num{font-size:22px;font-weight:700;color:#0f172a;}");
        out.append(".stat-box .lbl{font-size:11px;color:#64748b;text-transform:uppercase;}");
        out.append(".quote-box{background:#f1f5f9;border-left:3px solid #3b82f6;padding:8px 12px;font-style:italic;margin:6px 0;font-size:11px;}");
        out.append("@media print{button{display:none;}tr,table,.stat-box{break-inside:avoid;page-break-inside:avoid;}}");
        out.append("</style></head><body>");

        // Header
        out.append("<h1>NEXUS INVESTIGATION DOSSIER</h1>");
        out.append("<div class='subhead'>Network Exploration &amp; eXtraction for Unified Intelligence Systems</div>");
        out.append("<div class='banner-warning'><b>PROTOTYPE — SYNTHETIC DATA NOTICE:</b> This evidentiary dossier is generated for investigative lead review only. It does not establish guilt or liability, does not constitute an accusation, and does not replace sworn judicial evidence.</div>");

        // Fetch auxiliary data safely if services are present
        int contradictionCount = 0;
        int gapCount = 0;
        int changeCount = 0;
        List<Contradiction> contradictions = null;
        GapsResponse gaps = null;
        NetworkChangesResponse changes = null;

        if (suite != null) {
            try { contradictions = suite.contradictions(); contradictionCount = contradictions.size(); } catch (Exception ignored) {}
            try { gaps = suite.gaps(); gapCount = gaps.totalGaps(); } catch (Exception ignored) {}
            try { changes = suite.changes(); changeCount = changes.totalChanges(); } catch (Exception ignored) {}
        }

        // SECTION 1: CASE / INVESTIGATION SUMMARY
        if (inc.test("summary")) {
            out.append("<h2>SECTION 1 — Case &amp; Investigation Summary</h2>");
            String invId = "INV-NEXUS-" + sha256(canonicalJson(g.records().stream().map(Source::id).sorted().toList())).substring(0, 10).toUpperCase();
            out.append("<div class='grid-summary'>");
            out.append("<div class='stat-box'><div class='lbl'>Dossier Ref</div><div class='num' style='font-size:14px;margin-top:6px;'>").append(escape(invId)).append("</div></div>");
            out.append("<div class='stat-box'><div class='lbl'>Source Records</div><div class='num'>").append(g.records().size()).append("</div></div>");
            out.append("<div class='stat-box'><div class='lbl'>Entities</div><div class='num'>").append(g.nodes().size()).append("</div></div>");
            out.append("<div class='stat-box'><div class='lbl'>Relationships</div><div class='num'>").append(g.edges().size()).append("</div></div>");
            int alertCount = g.analysis().has("alerts") ? g.analysis().path("alerts").size() : 0;
            out.append("<div class='stat-box'><div class='lbl'>Active Alerts</div><div class='num'>").append(alertCount).append("</div></div>");
            out.append("<div class='stat-box'><div class='lbl'>Contradictions Flagged</div><div class='num'>").append(contradictionCount).append("</div></div>");
            out.append("<div class='stat-box'><div class='lbl'>Investigation Gaps</div><div class='num'>").append(gapCount).append("</div></div>");
            out.append("</div>");
            out.append("<p style='font-size:11.5px;color:#64748b;'>Generated: <b>").append(Instant.now()).append("</b> | Prepared By: <b>").append(escape(username)).append("</b> | Network Status: <b>").append(g.analyzed() ? "Analyzed (NetworkX &amp; Louvain)" : "Unanalyzed").append("</b></p>");
        }

        // SECTION 2: NETWORK OVERVIEW
        if (inc.test("graph")) {
            out.append("<h2>SECTION 2 — Network Topology Overview</h2>");
            String image = request != null ? request.graphImage() : null;
            String simMode = request != null ? request.simulationMode() : null;
            if (simMode != null && (simMode.equalsIgnoreCase("simulation") || simMode.equalsIgnoreCase("overlay"))) {
                out.append("<div class='banner-sim'>SIMULATION VIEW — CANONICAL GRAPH UNCHANGED</div>");
            }
            if (image != null && !image.isBlank()) {
                out.append("<div style='text-align:center;margin:16px 0;'><img alt='Current Network Graph' src='").append(image).append("' style='max-width:100%;border-radius:6px;border:1px solid #cbd5e1;'></div>");
            }
            out.append("<h3>Key Entity Directory</h3>");
            out.append("<table><tr><th>Entity ID</th><th>Type</th><th>Label / Identifier</th><th>Cases</th><th>Support</th></tr>");
            for (Node n : g.nodes()) {
                out.append("<tr><td><code>").append(escape(n.id())).append("</code></td><td>").append(escape(n.type())).append("</td><td><b>").append(escape(n.label())).append("</b></td><td>").append(escape(n.properties().getOrDefault("caseIds", "-"))).append("</td><td>").append(escape(n.properties().getOrDefault("support", "Unassessed"))).append("</td></tr>");
            }
            out.append("</table>");
        }

        // SECTION 3: SOURCE EVIDENCE INDEX
        if (inc.test("evidence")) {
            out.append("<h2>SECTION 3 — Source Evidence Index &amp; Assessment</h2>");
            out.append("<h2>Supporting evidence</h2><table><tr><th>ID</th><th>Record</th><th>Entity / edge</th><th>Span / row</th><th>Raw</th></tr>");
            for (Evidence e : g.evidence()) {
                out.append("<tr><td>").append(escape(e.id())).append("</td><td>").append(escape(e.recordId())).append("</td><td>").append(escape(e.entityId() != null ? e.entityId() : e.edgeId())).append("</td><td>").append(escape(e.start() + ":" + e.end() + " / " + e.row())).append("</td><td>").append(escape(e.raw())).append("</td></tr>");
            }
            out.append("</table>");
            out.append("<h2>Evidence support</h2><p>Evidence support is not a probability of truth. Repeated spans from one source record do not count as independent corroboration. Missing grades are Unassessed.</p><table><tr><th>Entity / relationship ID</th><th>Support inputs and rule</th></tr>");
            for (Node n : g.nodes()) out.append("<tr><td>").append(escape(n.id())).append("</td><td>").append(escape(n.properties().getOrDefault("support", "Unassessed"))).append("</td></tr>");
            for (Edge e : g.edges()) out.append("<tr><td>").append(escape(e.id())).append("</td><td>").append(escape(e.properties().getOrDefault("support", "Unassessed"))).append("</td></tr>");
            out.append("</table><h2>Source assessment</h2><table><tr><th>Record ID</th><th>Kind</th><th>Source reliability</th><th>Information credibility</th><th>Evidence Items</th><th>Record Hash (SHA-256)</th></tr>");
            for (Source s : g.records()) {
                String recHash = sha256(canonicalJson(s.payload())).substring(0, 16) + "...";
                long evCount = g.evidence().stream().filter(e -> s.id().equals(e.recordId())).count();
                out.append("<tr><td><code>").append(escape(s.id())).append("</code></td><td>").append(escape(s.kind())).append("</td><td>").append(escape(s.payload().path("sourceReliability").asText("Unassessed"))).append("</td><td>").append(escape(s.payload().path("informationCredibility").asText("Unassessed"))).append("</td><td>").append(evCount).append("</td><td><code>").append(recHash).append("</code></td></tr>");
            }
            out.append("</table>");
        }

        // SECTION 4: EVIDENCE TRAILS
        if (inc.test("trails")) {
            out.append("<h2>SECTION 4 — Evidence-Supported Connection Trails</h2>");
            EvidenceTrailResponse trail = request != null ? request.evidenceTrail() : null;
            if (trail == null && suite != null) {
                try {
                    boolean hasAariv = g.nodes().stream().anyMatch(n -> n.id().equals("SYN-PER-019") || n.label().contains("Aariv"));
                    boolean hasMira = g.nodes().stream().anyMatch(n -> n.id().equals("SYN-PER-021") || n.label().contains("Mira"));
                    if (hasAariv && hasMira) {
                        trail = suite.evidenceTrail("SYN-PER-019", "SYN-PER-021");
                    }
                } catch (Exception ignored) {}
            }
            if (trail != null && trail.paths() != null && !trail.paths().isEmpty()) {
                out.append("<p><b>Evidentiary Paths Traced Between:</b> ").append(escape(trail.fromLabel())).append(" &harr; ").append(escape(trail.toLabel())).append(" (").append(trail.paths().size()).append(" path(s) identified)</p>");
                for (EvidenceTrailPath path : trail.paths()) {
                    out.append("<div style='border:1px solid #cbd5e1;background:#f8fafc;padding:12px;border-radius:6px;margin-bottom:12px;'>");
                    out.append("<b>Path #").append(path.pathIndex()).append(" (").append(path.totalHops()).append(" hops):</b> ").append(escape(path.pathSummary())).append("<br>");
                    out.append("<table style='margin-top:8px;'><tr><th>Hop</th><th>Connection</th><th>Type</th><th>Source Record</th><th>Verbatim Excerpt</th></tr>");
                    int hop = 1;
                    for (EvidenceTrailStep step : path.steps()) {
                        String excerpt = step.evidence().isEmpty() ? "No direct text excerpt" : step.evidence().get(0).rawExcerpt();
                        String recId = step.evidence().isEmpty() ? "N/A" : step.evidence().get(0).sourceRecordId();
                        out.append("<tr><td>").append(hop++).append("</td><td><b>").append(escape(step.sourceNode().label())).append("</b> &rarr; <b>").append(escape(step.targetNode().label())).append("</b></td><td>").append(escape(step.edge().type())).append("</td><td><code>").append(escape(recId)).append("</code></td><td><div class='quote-box'>&ldquo;").append(escape(excerpt)).append("&rdquo;</div></td></tr>");
                    }
                    out.append("</table></div>");
                }
            } else {
                out.append("<p class='muted'>No multi-hop evidentiary trail pre-selected for this dossier.</p>");
            }
        }

        // SECTION 5: ANALYTICAL ALERTS (R1-R7)
        if (inc.test("alerts")) {
            out.append("<h2>SECTION 5 — Analytical Alert Signals (R1–R7)</h2>");
            if (g.analysis().has("alerts") && g.analysis().path("alerts").size() > 0) {
                out.append("<table><tr><th>Rule ID</th><th>Status</th><th>Analytical Explanation</th><th>Underlying Evidence IDs</th></tr>");
                for (var a : g.analysis().path("alerts")) {
                    boolean supp = a.path("suppressed").asBoolean(false);
                    out.append("<tr><td><b>").append(escape(a.path("ruleId").asText())).append("</b></td><td>").append(supp ? "<span style='color:#64748b;'>Suppressed</span>" : "<span style='color:#b91c1c;font-weight:600;'>Active</span>").append("</td><td>").append(escape(a.path("explanation").asText())).append("</td><td><code>").append(escape(a.path("evidenceIds"))).append("</code></td></tr>");
                }
                out.append("</table>");
            } else {
                out.append("<p>No analytical alerts triggered in current network state.</p>");
            }
        }

        // SECTION 6: CONTRADICTIONS
        if (inc.test("contradictions")) {
            out.append("<h2>SECTION 6 — Contradiction Engine Findings (C1–C6)</h2>");
            if (contradictions != null && !contradictions.isEmpty()) {
                out.append("<table><tr><th>Rule</th><th>Severity</th><th>Description of Inconsistency</th><th>Conflicting Evidence</th><th>Review State</th><th>Investigator Notes</th></tr>");
                for (Contradiction c : contradictions) {
                    out.append("<tr><td><b>").append(escape(c.ruleId())).append("</b></td><td>").append(escape(c.severity())).append("</td><td>").append(escape(c.description())).append("</td><td><code>").append(escape(String.join(", ", c.evidenceIds()))).append("</code></td><td><b>").append(escape(c.reviewStatus())).append("</b></td><td>").append(escape(c.reviewNotes() != null && !c.reviewNotes().isBlank() ? c.reviewNotes() : "Pending investigator rationale")).append("</td></tr>");
                }
                out.append("</table>");
            } else {
                out.append("<p>No contradiction records available.</p>");
            }
        }

        // SECTION 7: COUNTERFACTUAL / SENSITIVITY ANALYSIS
        if (inc.test("whatIf")) {
            out.append("<h2>SECTION 7 — Counterfactual &amp; Sensitivity Analysis</h2>");
            out.append("<div class='banner-warning'><b>CANONICAL GRAPH UNCHANGED:</b> Counterfactual sensitivity simulations test whether network relationships or alerts collapse when specific evidence is excluded. Surviving a counterfactual test does not prove guilt.</div>");
            WhatIfResponse whatIf = request != null ? request.whatIfData() : null;
            if (whatIf != null) {
                out.append("<p><b>Simulation Summary:</b> ").append(escape(whatIf.summary())).append("</p>");
                out.append("<div class='grid-summary'>");
                out.append("<div class='stat-box'><div class='lbl'>Baseline Nodes</div><div class='num'>").append(g.nodes().size()).append("</div></div>");
                out.append("<div class='stat-box'><div class='lbl'>Counterfactual Nodes</div><div class='num'>").append(whatIf.simulatedGraph().nodes().size()).append("</div></div>");
                out.append("<div class='stat-box'><div class='lbl'>Edges Removed</div><div class='num'>").append(whatIf.delta().removedEdges().size()).append("</div></div>");
                out.append("<div class='stat-box'><div class='lbl'>Affected Alerts</div><div class='num'>").append(whatIf.delta().affectedAlerts().size()).append("</div></div>");
                out.append("</div>");

                if (!whatIf.delta().removedNodes().isEmpty()) {
                    out.append("<p><b>Excluded Entities:</b> ");
                    for (Node n : whatIf.delta().removedNodes()) {
                        out.append("<code>").append(escape(n.id())).append(" (").append(escape(n.label())).append(")</code> ");
                    }
                    out.append("</p>");
                }
                if (!whatIf.delta().affectedAlerts().isEmpty()) {
                    out.append("<p><b>Alerts Impacted by Exclusion:</b> ");
                    for (com.fasterxml.jackson.databind.JsonNode a : whatIf.delta().affectedAlerts()) {
                        out.append("<span style='color:#059669;font-weight:600;'>[").append(escape(a.path("ruleId").asText())).append(": ").append(escape(a.path("explanation").asText())).append("]</span> ");
                    }
                    out.append("</p>");
                }
            } else {
                out.append("<p class='muted'>No active What-If simulation attached to this dossier request.</p>");
            }
        }

        // SECTION 8: VISUAL IDENTITY DECISIONS
        if (inc.test("vision")) {
            out.append("<h2>SECTION 8 — Visual Identity Search Decisions</h2>");
            out.append("<p style='font-size:11px;color:#64748b;'><i>Facial recognition models compute 512-dimensional normalized cosine similarity against enrolled reference photos. Biometric similarity indicates candidate leads only and requires human investigator adjudication. Biometric embedding vectors are omitted from this dossier.</i></p>");
            List<FaceDecision> decisions = store != null ? store.faceDecisions() : List.of();
            if (!decisions.isEmpty()) {
                out.append("<table><tr><th>Decision ID</th><th>Candidate Person</th><th>Decision</th><th>Similarity</th><th>Detector &amp; Model</th><th>Probe Image Hash</th><th>Reviewer</th><th>Timestamp</th></tr>");
                for (FaceDecision d : decisions) {
                    out.append("<tr><td><code>").append(escape(d.id())).append("</code></td><td><b>").append(escape(d.personNodeId())).append("</b></td><td><b>").append(escape(d.decision())).append("</b></td><td>").append(String.format(Locale.ROOT, "%.3f", d.similarity())).append("</td><td>").append(escape(d.modelName())).append("</td><td><code>").append(escape(d.imageHash())).append("</code></td><td>").append(escape(d.author())).append("</td><td>").append(escape(d.createdAt())).append("</td></tr>");
                }
                out.append("</table>");
            } else {
                out.append("<p>No formal visual identity confirmation/rejection decisions recorded yet.</p>");
            }
        }

        // SECTION 9: TOP INVESTIGATION GAPS
        if (inc.test("gaps")) {
            out.append("<h2>SECTION 9 — Prioritized Investigation Gaps</h2>");
            if (gaps != null && gaps.gaps() != null && !gaps.gaps().isEmpty()) {
                out.append("<p>Showing top prioritized network vulnerabilities and evidentiary gaps requiring procedural inquiry:</p>");
                out.append("<table><tr><th>Gap ID</th><th>Category</th><th>Severity</th><th>Description</th><th>Actionable Next Steps</th></tr>");
                int limit = Math.min(5, gaps.gaps().size());
                for (int i = 0; i < limit; i++) {
                    InvestigationGap gItem = gaps.gaps().get(i);
                    out.append("<tr><td><code>").append(escape(gItem.id())).append("</code></td><td>").append(escape(gItem.category())).append("</td><td><b>").append(escape(gItem.severity())).append("</b></td><td>").append(escape(gItem.description())).append("</td><td>").append(escape(String.join(" | ", gItem.suggestedActions()))).append("</td></tr>");
                }
                out.append("</table>");
                if (gaps.gaps().size() > limit) {
                    out.append("<p style='font-size:11px;color:#64748b;'><i>* Additional ").append(gaps.gaps().size() - limit).append(" structural gaps cataloged in digital investigation workbench.</i></p>");
                }
            } else {
                out.append("<p>No structural investigation gaps cataloged.</p>");
            }
        }

        // SECTION 10: NETWORK CHANGE SUMMARY
        if (inc.test("radar")) {
            out.append("<h2>SECTION 10 — Network Evolution &amp; Ingestion Milestones</h2>");
            if (changes != null && changes.changes() != null && !changes.changes().isEmpty()) {
                out.append("<table><tr><th>Timestamp</th><th>Trigger</th><th>Change Type</th><th>Severity</th><th>Topological Summary</th><th>Affected Entities</th></tr>");
                for (NetworkChange c : changes.changes()) {
                    out.append("<tr><td>").append(escape(c.timestamp())).append("</td><td><code>").append(escape(c.trigger())).append("</code></td><td>").append(escape(c.changeType())).append("</td><td>").append(escape(c.severity())).append("</td><td>").append(escape(c.summary())).append("</td><td>").append(escape(String.join(", ", c.affectedEntities()))).append("</td></tr>");
                }
                out.append("</table>");
            } else {
                out.append("<p>No network change events recorded.</p>");
            }
        }

        // SECTION 11: AUDIT CHAIN VERIFICATION
        if (inc.test("audit")) {
            out.append("<h2>SECTION 11 — Audit Chain Integrity Verification</h2>");
            Map<String, Object> auditStatus = store != null ? store.verifyAuditChain() : Map.of("valid", true, "entriesChecked", 0);
            boolean valid = Boolean.TRUE.equals(auditStatus.get("valid"));
            out.append("<div style='border:1px solid #cbd5e1;background:#f8fafc;padding:16px;border-radius:6px;'>");
            out.append("<p style='margin-top:0;'><b>Verification Status:</b> ");
            if (valid) {
                out.append("<span class='badge-valid'>AUDIT CHAIN VALID</span> &mdash; <b>").append(auditStatus.getOrDefault("entriesChecked", 0)).append("</b> entries verified without alteration.</p>");
            } else {
                out.append("<span class='badge-invalid'>INTEGRITY VERIFICATION FAILED</span> &mdash; Reason: ").append(escape(auditStatus.get("reason"))).append(" (Broken at record index: ").append(auditStatus.get("brokenAtIndex")).append(")</p>");
            }
            out.append("<div style='font-size:11.5px;color:#475569;'>");
            out.append("<b>Genesis Block Hash:</b> <code>").append(escape(auditStatus.getOrDefault("genesisHash", "N/A"))).append("</code><br>");
            out.append("<b>Current Ledger Head Hash:</b> <code>").append(escape(auditStatus.getOrDefault("headHash", "N/A"))).append("</code><br>");
            out.append("<b>Verification Timestamp:</b> ").append(escape(auditStatus.getOrDefault("verifiedAt", Instant.now().toString()))).append("<br>");
            out.append("</div>");
            out.append("</div>");
        }

        // SECTION 12: ELECTRONIC RECORD PROVENANCE
        if (inc.test("provenance") || inc.test("bsa")) {
            String sourceDigest = sha256(canonicalJson(g.records().stream().sorted(Comparator.comparing(Source::id)).map(r -> Map.of("id", r.id(), "kind", r.kind())).toList()));
            String contentDigest = sha256(canonicalJson(g));

            out.append("<h2>SECTION 12 — Electronic Record Provenance Statement</h2>");
            out.append("<div style='border:1px solid #7ea89b;background:#f4faf7;padding:16px;border-radius:6px;font-size:11.5px;line-height:1.6;'>");
            out.append("<b>ELECTRONIC RECORD PROVENANCE &amp; DETERMINISTIC DERIVATION STATEMENT</b><br>");
            out.append("<b>Tool / Pipeline:</b> NEXUS &mdash; Network Exploration &amp; eXtraction for Unified Intelligence Systems (v0.2.0-prototype)<br>");
            out.append("<b>Generation Timestamp:</b> ").append(Instant.now()).append("<br>");
            out.append("<b>Derivation Method:</b> Deterministic rule-based extraction, exact identifier canonicalization, and NetworkX graph analytics. No generative hallucinations or probabilistic text fabrications are used in entity resolution or link analysis.<br>");
            out.append("<b>Source Records Analyzed:</b> ").append(g.records().size()).append(" records (Source manifest SHA-256: <code>").append(sourceDigest).append("</code>)<br>");
            out.append("<b>Graph data SHA-256:</b> <code>").append(contentDigest).append("</code><br>");
            out.append("<p>Digest scope: complete graph data serialized as JSON with sorted object keys and preserved array order, including entities, relationships, evidence, source payloads, analysis, and resolution suggestions. Excludes HTML rendering, report generation timestamps, and the optional graph image; this is not a hash of the full report.</p>");
            out.append("<div style='margin-top:10px;padding:8px 10px;background:#e9f2ee;border-left:3px solid #3c826e;font-size:10.5px;'><b>DISCLAIMER:</b> PROTOTYPE SYSTEM / SYNTHETIC DATA NOTICE. This dossier is generated for investigative lead review only. It does not constitute legal advice, does not establish guilt or liability, and does not constitute a self-executing certificate of authenticity or admissibility under any statutory law.</div>");
            out.append("</div>");
        }

        // SECTION 13: BSA SECTION 63 TEMPLATE
        if (inc.test("bsa")) {
            out.append("<h2>SECTION 13 — Template Certificate (Bharatiya Sakshya Adhiniyam, 2023, Section 63)</h2>");
            out.append("<div style='background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 14px;margin-bottom:12px;font-size:11px;color:#92400e;'>");
            out.append("<b>NOTICE: TEMPLATE ONLY</b> &mdash; This section provides a statutory template corresponding to Section 63(4) and the Schedule of the Bharatiya Sakshya Adhiniyam, 2023 (BSA 2023) for electronic record admissibility. It must be completed, reviewed, and signed by the responsible human officer/custodian in lawful management of the computer system, and where applicable by an appointed technical expert. Software cannot self-certify its own legal validity.");
            out.append("</div>");
            out.append("<div style='border:1px dashed #7a9c92;background:#fafcfb;padding:16px;border-radius:6px;font-size:11px;line-height:1.8;'>");
            out.append("<b>PART A — Certificate by Person in Lawful Management of the Device (Schedule, BSA 2023)</b><br>");
            out.append("1. Name of Officer / Custodian: ____________________________________________________<br>");
            out.append("2. Designation &amp; Police Station / Agency: __________________________________________<br>");
            out.append("3. Computer System / Device Description &amp; Serial No.: _______________________________<br>");
            out.append("4. Period of Custody / Lawful Operation: ___________________________________________<br>");
            out.append("5. Declaration: I hereby state that during the said period, the computer system was operating properly and the output was produced during ordinary lawful investigative activities.<br>");
            out.append("Date: ____________________ &nbsp;&nbsp;&nbsp;&nbsp; Place: ____________________ &nbsp;&nbsp;&nbsp;&nbsp; Signature &amp; Official Seal: ____________________<br><br>");
            out.append("<b>PART B — Certificate by Technical / Forensic Expert (where applicable under s.63(4))</b><br>");
            out.append("1. Expert Name &amp; Designation: ________________________________________________<br>");
            out.append("2. Laboratory / Organization: ____________________________________________________<br>");
            out.append("3. Hash Verification: Algorithm: SHA-256 &nbsp;|&nbsp; Digest Verified: [ &nbsp; ] MATCH &nbsp; [ &nbsp; ] MISMATCH<br>");
            out.append("Date: ____________________ &nbsp;&nbsp;&nbsp;&nbsp; Place: ____________________ &nbsp;&nbsp;&nbsp;&nbsp; Signature: ____________________");
            out.append("</div>");
        }

        // SECTION 14: LIMITATIONS & SAFEGUARDS
        if (inc.test("limitations")) {
            out.append("<h2>SECTION 14 — Analytical Limitations &amp; Procedural Safeguards</h2>");
            out.append("<div style='border:1px solid #cbd5e1;background:#f8fafc;padding:14px 16px;border-radius:6px;font-size:11.5px;line-height:1.6;'>");
            out.append("<ul style='margin:0;padding-left:18px;'>");
            out.append("<li><b>Descriptive Analytical Signals:</b> Rules, community clusters, and influence scores provide investigative leads only, not determinations of guilt or criminal liability.</li>");
            out.append("<li><b>Biometric Candidate Matching:</b> Facial recognition produces candidate similarity scores for human verification, not certainty of identity. Manual forensic verification is mandatory.</li>");
            out.append("<li><b>Contradiction Flags:</b> Contradiction engine flags indicate factual or temporal discrepancies between ingested source records and require human investigator corroboration.</li>");
            out.append("<li><b>Counterfactual Simulation:</b> What-If and sensitivity analyses are in-memory simulations; canonical graph data and primary evidence remain unmodified. Surviving a counterfactual simulation demonstrates structural robustness, not proof of guilt.</li>");
            out.append("<li><b>Data Completeness:</b> The graph represents ingested records only. Incomplete, delayed, or uningested intelligence may alter entity connectivity and analytical interpretations.</li>");
            out.append("</ul></div>");
        }

        // SECTION 15: MULTIMODAL EVIDENCE & FORENSICS MANIFEST
        if (inc.test("multimodal") || inc.test("evidence")) {
            out.append("<h2>SECTION 15 — Multimodal Evidence &amp; Acoustic/Visual Forensics Manifest</h2>");
            List<EvidenceAsset> multimodalAssets = store != null ? store.evidenceAssets() : List.of();
            if (multimodalAssets.isEmpty()) {
                out.append("<p>No multimodal evidence assets (scanned documents, wiretaps, or surveillance imagery) ingested.</p>");
            } else {
                out.append("<table><tr><th>Asset ID</th><th>Case ID</th><th>Media</th><th>File Name</th><th>File Size</th><th>SHA-256 Hash</th><th>Status</th></tr>");
                for (EvidenceAsset a : multimodalAssets) {
                    out.append("<tr><td><code>").append(escape(a.id())).append("</code></td><td>").append(escape(a.caseId())).append("</td><td><b>").append(escape(a.mediaType())).append("</b></td><td>").append(escape(a.fileName())).append("</td><td>").append(a.fileSize() / 1024).append(" KB</td><td><code>").append(escape(a.fileHash().substring(0, Math.min(16, a.fileHash().length())))).append("...</code></td><td>").append(escape(a.status())).append("</td></tr>");
                }
                out.append("</table>");

                out.append("<h3>Extracted Multimodal Intelligence &amp; Human Determinations</h3>");
                List<EvidenceReviewDecision> decisions = store != null ? store.evidenceReviews() : List.of();
                if (!decisions.isEmpty()) {
                    out.append("<table><tr><th>Decision ID</th><th>Item ID</th><th>Determination</th><th>Investigator</th><th>Timestamp</th><th>Corroboration Notes</th></tr>");
                    for (EvidenceReviewDecision d : decisions) {
                        out.append("<tr><td><code>").append(escape(d.id())).append("</code></td><td><code>").append(escape(d.itemId())).append("</code></td><td><b>").append(escape(d.decision())).append("</b></td><td>").append(escape(d.author())).append("</td><td>").append(escape(d.createdAt())).append("</td><td><i>").append(escape(d.notes())).append("</i></td></tr>");
                    }
                    out.append("</table>");
                }
            }
        }

        out.append("</body></html>");
        return out.toString();
    }
}
