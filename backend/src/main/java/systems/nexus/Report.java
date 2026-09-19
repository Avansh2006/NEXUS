package systems.nexus;

import static systems.nexus.Model.*;
import java.time.Instant;

public final class Report {
    private Report() {}
    static String escape(Object value) {return String.valueOf(value).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
    static String sha256(String input) {
        try {
            var md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            var hex = new StringBuilder();
            for (byte b : d) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception ex) { return "n/a"; }
    }
    public static String render(Graph g,String image) {
        StringBuilder out=new StringBuilder("<!doctype html><html lang='en'><meta charset='UTF-8'><title>NEXUS Investigation Report</title><style>body{font:14px system-ui;max-width:1100px;margin:40px auto;color:#162b32}h1{letter-spacing:4px}table{border-collapse:collapse;width:100%;font-size:11px}td,th{padding:7px;border:1px solid #cbd5d9;text-align:left;overflow-wrap:anywhere}pre{white-space:pre-wrap}img{max-width:100%}.banner{background:#fff2c9;padding:14px}h2{margin-top:32px}@media print{button{display:none}tr{break-inside:avoid}}</style><body><h1>NEXUS</h1><p>Network Exploration &amp; eXtraction for Unified Intelligence Systems</p><p class='banner'>PROTOTYPE — SYNTHETIC DATA · Leads for human review, not findings of guilt.</p>");
        out.append("<p>Generated ").append(Instant.now()).append(" · ").append(g.analyzed()?"Analyzed network":"Analysis not yet run").append("</p>");
        out.append("<p>").append(g.records().size()).append(" source records · ").append(g.nodes().size()).append(" entities · ").append(g.edges().size()).append(" relationships</p>");
        if(image!=null) out.append("<img alt='Current investigation graph' src='").append(image).append("'>");
        out.append("<h2>Cases</h2><ul>");for(Node n:g.nodes()) if(n.type().equals("Case")) out.append("<li>").append(escape(n.label())).append(" — ").append(escape(n.properties().getOrDefault("crimeType",""))).append("</li>");out.append("</ul>");
        out.append("<h2>Patterns and explanations</h2>");for(var a:g.analysis().path("alerts")) out.append("<p><b>").append(escape(a.path("ruleId").asText())).append(a.path("suppressed").asBoolean()?" [suppressed]":"").append("</b> ").append(escape(a.path("explanation").asText())).append("<br>Evidence: ").append(escape(a.path("evidenceIds"))).append("</p>");
        out.append("<h2>Entities and influence</h2><p>Influence = 100 × (0.45 degree + 0.35 normalized betweenness + 0.20 normalized case count). Descriptive connectivity only.</p><table><tr><th>ID / type</th><th>Entity</th><th>Cases</th><th>Influence</th></tr>");
        for(Node n:g.nodes()) {String influence="Not analyzed";for(var m:g.analysis().path("metrics")) if(m.path("entityId").asText().equals(n.id())) influence=m.path("influence").asText();out.append("<tr><td>").append(escape(n.id())).append(" / ").append(n.type()).append("</td><td>").append(escape(n.label())).append("</td><td>").append(escape(n.properties().get("caseIds"))).append("</td><td>").append(influence).append("</td></tr>");}out.append("</table>");
        out.append("<h2>Relationships and timeline</h2><table><tr><th>From → To</th><th>Type</th><th>First / last seen</th><th>Evidence</th></tr>");for(Edge e:g.edges()) out.append("<tr><td>").append(escape(e.source()+" → "+e.target())).append("</td><td>").append(e.type()).append("</td><td>").append(escape(e.properties().get("firstSeen"))).append("<br>").append(escape(e.properties().get("lastSeen"))).append("</td><td>").append(escape(e.properties().get("evidenceIds"))).append("</td></tr>");out.append("</table>");
        out.append("<h2>Supporting evidence</h2><table><tr><th>ID</th><th>Record</th><th>Entity / edge</th><th>Span / row</th><th>Raw</th></tr>");for(Evidence e:g.evidence()) out.append("<tr><td>").append(escape(e.id())).append("</td><td>").append(escape(e.recordId())).append("</td><td>").append(escape(e.entityId()!=null?e.entityId():e.edgeId())).append("</td><td>").append(escape(e.start()+":"+e.end()+" / "+e.row())).append("</td><td>").append(escape(e.raw())).append("</td></tr>");out.append("</table>");
        String sourceAggregate = g.records().stream().map(r -> r.id() + ":" + r.kind()).reduce("", (a, b) -> a + "|" + b);
        String sourceDigest = sha256(sourceAggregate.isEmpty() ? "none" : sourceAggregate);
        String contentDigest = sha256(g.nodes().size() + ":" + g.edges().size() + ":" + g.evidence().size() + ":" + sourceDigest);

        out.append("<h2>Electronic Record Provenance Statement</h2>");
        out.append("<div style='border:1px solid #7ea89b;background:#f4faf7;padding:16px;border-radius:6px;font-size:11.5px;line-height:1.6;'>");
        out.append("<b>ELECTRONIC RECORD PROVENANCE &amp; DETERMINISTIC DERIVATION STATEMENT</b><br>");
        out.append("<b>Tool / Pipeline:</b> NEXUS — Network Exploration &amp; eXtraction for Unified Intelligence Systems (v0.2.0-prototype)<br>");
        out.append("<b>Generation Timestamp:</b> ").append(Instant.now()).append("<br>");
        out.append("<b>Derivation Method:</b> Deterministic rule-based extraction, exact identifier canonicalization, and NetworkX graph analytics. No generative models or probabilistic text fabrication are used in entity resolution or link analysis.<br>");
        out.append("<b>Source Records Analyzed:</b> ").append(g.records().size()).append(" records (Aggregate Source Hash: <code>").append(sourceDigest).append("</code>)<br>");
        out.append("<b>Dossier Content Integrity Hash:</b> <code>").append(contentDigest).append("</code> (SHA-256)<br>");
        out.append("<div style='margin-top:10px;padding:8px 10px;background:#e9f2ee;border-left:3px solid #3c826e;font-size:10.5px;'><b>DISCLAIMER:</b> PROTOTYPE SYSTEM / SYNTHETIC DATA NOTICE. This dossier is generated for investigative lead review only. It does not constitute legal advice, does not establish guilt or liability, and does not constitute a self-executing certificate of authenticity or admissibility under any statutory law.</div>");
        out.append("</div>");

        out.append("<h2>Template Certificate (Bharatiya Sakshya Adhiniyam, 2023, Section 63)</h2>");
        out.append("<p style='font-size:11px;color:#4c6368;'><i>This template corresponds to Section 63(4) and the Schedule of the Bharatiya Sakshya Adhiniyam, 2023 (BSA 2023) for electronic record admissibility. It must be completed and signed by the responsible human officer/custodian in lawful management of the computer system, and where applicable by an appointed technical expert. Software cannot certify its own legal validity.</i></p>");
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
        return out.append("</body></html>").toString();
    }
}
