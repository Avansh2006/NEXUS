package systems.nexus;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.commons.csv.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.io.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import static systems.nexus.Model.*;

@Service
@Transactional
public class InvestigationService {
    private final Store store; private final EngineClient engine; private final ObjectMapper json; private final String demoDir;
    public InvestigationService(Store store,EngineClient engine,ObjectMapper json,@Value("${nexus.demo-dir}") String demoDir) { this.store=store;this.engine=engine;this.json=json;this.demoDir=demoDir; }
    private static String required(JsonNode p,String key) {
        String v=p.path(key).asText("").trim();
        if(v.isBlank()||v.length()>300||v.contains("\uFFFD")) throw new IllegalArgumentException(key+" must be nonempty, valid UTF-8, at most 300 characters");
        return v;
    }
    public synchronized IngestResult ingest(String kind,IngestRequest request) {
        if(!Set.of("fir","criminal-history","intel-report","surveillance-report","cdr","transactions").contains(kind)) throw new IllegalArgumentException("Unsupported source kind");
        List<JsonNode> rows=request.records();
        if("csv".equals(request.format())) {
            if(request.content()==null||request.content().contains("\uFFFD")) throw new IllegalArgumentException("CSV must contain valid UTF-8 content");
            rows=new ArrayList<>();
            try(var parser=CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setIgnoreEmptyLines(true).get().parse(new StringReader(request.content()))) {
                for(CSVRecord row:parser) { if(rows.size()>=500) throw new IllegalArgumentException("Maximum 500 rows per request"); rows.add(json.valueToTree(row.toMap())); }
            } catch(IOException e) { throw new IllegalArgumentException("Malformed CSV"); }
        }
        if(rows==null||rows.isEmpty()||rows.size()>500) throw new IllegalArgumentException("Supply 1–500 records");
        List<RowError> errors=new ArrayList<>(); int accepted=0,duplicates=0;
        for(int i=0;i<rows.size();i++) {
            ObjectNode p;
            try {
                if(rows.get(i)==null||!rows.get(i).isObject()) throw new IllegalArgumentException("Row must be an object");
                p=(ObjectNode)rows.get(i).deepCopy();p.remove(List.of("_entities","_row"));
                required(p,"caseId");
                if(GraphBuilder.narrative(kind)) {
                    String t=p.path("text").asText("");
                    if(!p.path("text").isTextual()||t.isBlank()||t.length()>10000||t.contains("\uFFFD")) throw new IllegalArgumentException("Narrative text must contain 1–10000 valid characters");
                    p.put("date",Instant.parse(required(p,"date")).toString());
                    if(p.has("sourceReliability") && (!p.get("sourceReliability").isTextual() || !p.get("sourceReliability").asText().matches("[A-F]"))) throw new IllegalArgumentException("sourceReliability must be A–F");
                    if(p.has("informationCredibility") && (!(p.get("informationCredibility").isTextual() || p.get("informationCredibility").isIntegralNumber()) || !p.get("informationCredibility").asText().matches("[1-6]"))) throw new IllegalArgumentException("informationCredibility must be 1–6");
                    if(p.has("informationCredibility"))p.put("informationCredibility",p.get("informationCredibility").asText());
                    if(p.has("crimeType")) required(p,"crimeType");
                } else {
                    String from=required(p,"from"),to=required(p,"to");
                    p.put("from",kind.equals("cdr")?GraphBuilder.phone(from):GraphBuilder.account(from));
                    p.put("to",kind.equals("cdr")?GraphBuilder.phone(to):GraphBuilder.account(to));
                    p.put("timestamp",Instant.parse(required(p,"timestamp")).toString());
                    String numeric=kind.equals("cdr")?"duration":"amount";
                    double v=Double.parseDouble(required(p,numeric));
                    if(!Double.isFinite(v)||v<0||v>1e12) throw new IllegalArgumentException(numeric+" must be finite and nonnegative");
                    p.put(numeric,v);
                    if(p.has("location")&&!p.path("location").asText().isBlank()) required(p,"location");
                }
            } catch(IllegalArgumentException|java.time.format.DateTimeParseException e) { errors.add(new RowError(i+1,e.getMessage()));continue; }
            // Canonical key order, normalized identifiers and numbers make duplicate detection independent of JSON field order.
            SortedMap<String,JsonNode> sorted=new TreeMap<>();p.fields().forEachRemaining(e->sorted.put(e.getKey(),e.getValue()));
            String hash=GraphBuilder.hash(kind+store.encode(sorted));
            if(store.exists(hash)) { duplicates++;continue; }
            String sid="src-"+hash.substring(0,24);
            if(GraphBuilder.narrative(kind)) p.set("_entities",json.valueToTree(engine.extract(p.path("text").asText(),sid).entities()));
            p.put("_row",i+1);store.source(sid,kind,hash,p);accepted++;
        }
        if(accepted>0) rebuild();
        store.audit("ingest:"+kind+" accepted="+accepted+" duplicates="+duplicates+" rejected="+errors.size());
        return new IngestResult(accepted,duplicates,errors);
    }
    private Map<String,String> stringMap(String state) { Map<String,String> m=new TreeMap<>();store.state(state).fields().forEachRemaining(e->m.put(e.getKey(),e.getValue().asText()));return m; }
    private Graph rebuild() {
        Graph g=new GraphBuilder(json,stringMap("aliases"),stringMap("decisions")).build(store.sources());
        if(g.nodes().size()>1500||g.edges().size()>10000) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Graph exceeds prototype limits");
        // Accepted decisions stay reviewable even after the right-hand entity is aliased away.
        List<Suggestion> suggestions=new ArrayList<>(g.suggestions());
        for(JsonNode s:store.state("accepted")) suggestions.add(json.convertValue(s,Suggestion.class));
        g=new Graph(g.nodes(),g.edges(),g.evidence(),g.records(),g.analysis(),false,suggestions);
        store.persist(g); return g;
    }
    public synchronized Map<String,IngestResult> load() throws IOException {
        Path path = Path.of(demoDir, "dataset.json");
        if (!Files.exists(path)) {
            if (Files.exists(Path.of("data/demo/dataset.json"))) {
                path = Path.of("data/demo/dataset.json");
            } else if (Files.exists(Path.of("../data/demo/dataset.json"))) {
                path = Path.of("../data/demo/dataset.json");
            }
        }
        JsonNode data=json.readTree(Files.readString(path));
        Map<String,IngestResult> results=new LinkedHashMap<>();
        for(String k:List.of("fir","cdr","transactions")) { List<JsonNode> rows=new ArrayList<>();data.path(k).forEach(rows::add);results.put(k,ingest(k,new IngestRequest(rows,null,null))); }
        store.audit("demo:load");return results;
    }
    public synchronized Map<String, Object> ingestIncomingFir() throws IOException {
        long start = System.nanoTime();
        Path path = Path.of(demoDir, "incoming", "NXS-007.json");
        if (!Files.exists(path)) {
            if (Files.exists(Path.of("data/demo/incoming/NXS-007.json"))) {
                path = Path.of("data/demo/incoming/NXS-007.json");
            } else if (Files.exists(Path.of("../data/demo/incoming/NXS-007.json"))) {
                path = Path.of("../data/demo/incoming/NXS-007.json");
            } else {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Incoming FIR file not found");
            }
        }
        JsonNode firNode = json.readTree(Files.readString(path));
        String caseId = firNode.path("caseId").asText("NXS-007");

        Set<String> existingNodeIds = new HashSet<>();
        for (Node n : graph().nodes()) existingNodeIds.add(n.id());

        IngestResult result = ingest("fir", new IngestRequest(List.of(firNode), null, null));
        if (result.accepted() == 0 && result.duplicates() > 0) {
            return Map.of(
                "status", "already_ingested",
                "caseId", caseId,
                "latencyMs", (System.nanoTime() - start) / 1_000_000.0,
                "message", "FIR NXS-007 is already ingested in the workspace",
                "graph", graph()
            );
        }

        analyze();
        Graph updatedGraph = graph();

        List<String> newNodes = new ArrayList<>();
        List<Map<String, Object>> crossCase = new ArrayList<>();

        for (Node n : updatedGraph.nodes()) {
            if (!existingNodeIds.contains(n.id())) {
                newNodes.add(n.id());
            }
            @SuppressWarnings("unchecked")
            List<String> cases = (List<String>) n.properties().get("caseIds");
            if (cases != null && cases.contains(caseId) && cases.size() > 1) {
                crossCase.add(Map.of(
                    "entityId", n.id(),
                    "label", n.label(),
                    "type", n.type(),
                    "cases", cases
                ));
            }
        }

        double latencyMs = (System.nanoTime() - start) / 1_000_000.0;
        store.audit("demo:incoming:ingest:"+caseId);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status", "ok");
        resp.put("caseId", caseId);
        resp.put("latencyMs", latencyMs);
        resp.put("newNodes", newNodes);
        resp.put("crossCaseLinks", crossCase);
        resp.put("graph", updatedGraph);
        return resp;
    }
    public synchronized Map<String, Object> removeIncomingFir() {
        String caseId = "NXS-007";
        store.deleteSourcesByCaseId(caseId);
        rebuild();
        if (!graph().nodes().isEmpty()) {
            analyze();
        }
        store.audit("demo:incoming:remove:"+caseId);
        return Map.of(
            "status", "ok",
            "removed", caseId,
            "graph", graph()
        );
    }
    public synchronized void reset() { store.reset();store.audit("demo:reset"); }
    public synchronized JsonNode analyze() {
        Graph g=store.graph();JsonNode result=engine.analyze(g);
        store.persist(new Graph(g.nodes(),g.edges(),g.evidence(),g.records(),result,true,g.suggestions()));store.audit("analysis:run");return result;
    }
    public Graph graph() { return store.graph(); }
    public Node node(String id) { return graph().nodes().stream().filter(n->n.id().equals(id)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Entity not found")); }
    public Map<String,Object> detail(String id) {
        Node n=node(id);Graph g=graph();
        List<Edge> es=g.edges().stream().filter(e->e.source().equals(id)||e.target().equals(id)).toList();
        Set<String> edgeIds=new HashSet<>();es.forEach(e->edgeIds.add(e.id()));
        List<Evidence> ev=g.evidence().stream().filter(e->id.equals(e.entityId())||edgeIds.contains(e.edgeId())).toList();
        Set<String> sourceIds=new HashSet<>();ev.forEach(e->sourceIds.add(e.recordId()));
        List<JsonNode> alerts=new ArrayList<>();for(JsonNode a:g.analysis().path("alerts")) for(JsonNode entity:a.path("entityIds")) if(entity.asText().equals(id)) { alerts.add(a);break; }
        store.audit("entity:view:"+id);
        return Map.of("node",n,"edges",es,"evidence",ev,"records",g.records().stream().filter(s->sourceIds.contains(s.id())).toList(),"alerts",alerts);
    }
    public Graph network(String id,int hops) {
        node(id);if(hops<1||hops>2) throw new IllegalArgumentException("hops must be 1 or 2");
        Graph g=graph();Set<String> ids=new HashSet<>(Set.of(id));
        for(int i=0;i<hops;i++) { Set<String> next=new HashSet<>(ids);for(Edge e:g.edges()) if(ids.contains(e.source())||ids.contains(e.target())) {next.add(e.source());next.add(e.target());}ids=next; }
        final Set<String> selected=ids; var es=g.edges().stream().filter(e->selected.contains(e.source())&&selected.contains(e.target())).toList();
        Set<String> eids=new HashSet<>();es.forEach(e->eids.add(e.id()));
        var ev=g.evidence().stream().filter(e->selected.contains(e.entityId())||eids.contains(e.edgeId())).toList();
        Set<String> records=new HashSet<>();ev.forEach(e->records.add(e.recordId()));
        return new Graph(g.nodes().stream().filter(n->selected.contains(n.id())).toList(),es,ev,g.records().stream().filter(s->records.contains(s.id())).toList(),g.analysis(),g.analyzed(),g.suggestions());
    }
    public List<Map<String,Object>> timeline(String id) {
        node(id);List<Map<String,Object>> events=new ArrayList<>();
        for(Edge e:graph().edges()) if(e.source().equals(id)||e.target().equals(id)) for(JsonNode event:json.valueToTree(e.properties()).path("events")) events.add(Map.of("edgeId",e.id(),"timestamp",event.path("timestamp").asText(),"evidenceId",event.path("evidenceId").asText(),"type",e.type()));
        events.sort(Comparator.comparing(e->e.get("timestamp").toString()));return events;
    }
    public PathResult path(String from,String to) {
        node(from);node(to);Graph g=graph();Map<String,Edge> prev=new HashMap<>();Set<String> seen=new HashSet<>(Set.of(from));Deque<String> q=new ArrayDeque<>();q.add(from);
        while(!q.isEmpty()&&!seen.contains(to)) {String n=q.remove();for(Edge e:g.edges()) {String other=e.source().equals(n)?e.target():e.target().equals(n)?e.source():null;if(other!=null&&seen.add(other)) {prev.put(other,e);q.add(other);} }}
        if(!seen.contains(to)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No connection path");
        LinkedList<String> ids=new LinkedList<>();LinkedList<Edge> es=new LinkedList<>();String cursor=to;ids.addFirst(cursor);
        while(!cursor.equals(from)) {Edge e=prev.get(cursor);es.addFirst(e);cursor=e.source().equals(cursor)?e.target():e.source();ids.addFirst(cursor);}
        return new PathResult(ids,es);
    }
    public synchronized Graph review(String id,boolean accept) {
        Suggestion s=graph().suggestions().stream().filter(x->x.id().equals(id)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Suggestion not found"));
        Map<String,String> aliases=stringMap("aliases"),decisions=stringMap("decisions");
        List<Suggestion> accepted=new ArrayList<>();for(JsonNode item:store.state("accepted")) {Suggestion a=json.convertValue(item,Suggestion.class);if(!a.id().equals(id)) accepted.add(a);}
        if(accept) {
            if(s.status().equals("accepted")) return graph();
            if(aliases.containsKey(s.left())||aliases.containsKey(s.right())||aliases.containsValue(s.right())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Undo overlapping matches before merging");
            aliases.put(s.right(),s.left());accepted.add(new Suggestion(s.id(),s.left(),s.right(),s.score(),s.reason(),"accepted"));
        } else aliases.remove(s.right());
        decisions.put(id,accept?"accepted":"rejected");store.state("aliases",aliases);store.state("decisions",decisions);store.state("accepted",accepted);store.audit("resolution:"+(accept?"accept:":"reject/undo:")+id);return rebuild();
    }
}
