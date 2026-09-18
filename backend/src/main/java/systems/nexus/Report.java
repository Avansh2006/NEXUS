package systems.nexus;

import static systems.nexus.Model.*;
import java.time.Instant;

public final class Report {
    private Report() {}
    static String escape(Object value) {return String.valueOf(value).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
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
        out.append("<h2>Source records</h2>");for(Source s:g.records()) out.append("<h3>").append(escape(s.id())).append(" · ").append(s.kind()).append("</h3><pre>").append(escape(s.payload().has("text")?s.payload().path("text").asText():s.payload().toString())).append("</pre>");
        return out.append("</body></html>").toString();
    }
}
