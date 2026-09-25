package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.MediaType;
import java.io.IOException;
import java.util.*;
import static systems.nexus.Model.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final InvestigationService service;private final Store store;private final EngineClient engine;private final ObjectMapper json;
    private final Auth auth;
    private final IntelligenceSuiteService suiteService;
    public ApiController(InvestigationService service,Store store,EngineClient engine,ObjectMapper json,Auth auth,IntelligenceSuiteService suiteService) {this.service=service;this.store=store;this.engine=engine;this.json=json;this.auth=auth;this.suiteService=suiteService;}
    @GetMapping("/health") public Map<String,String> health() {return Map.of("status","ok");}
    @PostMapping("/data/{kind:fir|cdr|transactions|criminal-history|intel-report|surveillance-report}") public IngestResult ingest(@PathVariable String kind,@RequestBody IngestRequest body) {return service.ingest(kind,body);}
    @PostMapping("/demo/load") public Map<String,IngestResult> load() throws IOException {return service.load();}
    @PostMapping("/demo/reset") public Map<String,Boolean> reset() {service.reset();return Map.of("reset",true);}
    @PostMapping("/demo/incoming") public Map<String,Object> incoming() throws IOException {return service.ingestIncomingFir();}
    @PostMapping("/demo/incoming/remove") public Map<String,Object> incomingRemove() {return service.removeIncomingFir();}
    @PostMapping("/analyze") public JsonNode analyze() {return service.analyze();}
    @GetMapping("/graph") public Graph graph() {store.audit("graph:view");return service.graph();}
    @GetMapping("/network/{id}") public Graph network(@PathVariable String id,@RequestParam(defaultValue="1") int hops) {return service.network(id,hops);}
    @GetMapping("/entities/search") public List<Node> search(@RequestParam(defaultValue="") String q) {if(q.length()>100) throw new IllegalArgumentException("Search must be at most 100 characters");return service.graph().nodes().stream().filter(n->n.label().toLowerCase(Locale.ROOT).contains(q.toLowerCase(Locale.ROOT))).toList();}
    @GetMapping("/entities/{id}") public Map<String,Object> entity(@PathVariable String id) {return service.detail(id);}
    private JsonNode part(String key) {return service.graph().analysis().has(key)?service.graph().analysis().get(key):json.createArrayNode();}
    @GetMapping("/clusters") public JsonNode clusters() {return part("communities");}
    @GetMapping("/case-links") public JsonNode caseLinks() {return part("caseLinks");}
    @GetMapping("/influencers") public JsonNode influencers() {return part("metrics");}
    @GetMapping("/suspicious-patterns") public JsonNode alerts() {return part("alerts");}
    @GetMapping("/timeline/{id}") public List<Map<String,Object>> timeline(@PathVariable String id) {return service.timeline(id);}
    @GetMapping("/paths") public PathResult path(@RequestParam String from,@RequestParam String to) {return service.path(from,to);}
    @GetMapping("/link-suggestions") public List<Suggestion> suggestions() {return service.graph().suggestions();}
    @PostMapping("/link-suggestions/{id}/{action:accept|reject}") public Graph review(@PathVariable String id,@PathVariable String action) {return service.review(id,action.equals("accept"));}
    @GetMapping("/quality") public JsonNode quality() {return engine.quality();}
    @GetMapping("/audit") public List<Map<String,Object>> audit() {return store.audit();}
    @GetMapping("/audit/verify") public Map<String,Object> verifyAudit() {return store.verifyAuditChain();}
    @PostMapping("/auth/login") public Map<String,Object> login(@RequestBody Map<String,String> creds) {
        var result=auth.login(creds.get("username"),creds.get("password"));
        store.audit("auth:login",result.get("username").toString(),"","");
        return result;
    }
    @GetMapping("/auth/me") public Map<String,Object> me(jakarta.servlet.http.HttpServletRequest req) {
        String u = (String) req.getAttribute("nexus.user");
        String r = (String) req.getAttribute("nexus.role");
        return Map.of("username", u, "role", r);
    }
    @PostMapping(value="/reports",produces=MediaType.TEXT_HTML_VALUE) public String report(@RequestBody(required=false) ReportRequest request, jakarta.servlet.http.HttpServletRequest req) {
        String image=request==null?null:request.graphImage();
        if(image!=null&&(!image.matches("data:image/png;base64,[A-Za-z0-9+/=]+")||image.length()>3000000)) throw new IllegalArgumentException("Report image must be a PNG data URL below 3 MB");
        String user = (String) req.getAttribute("nexus.user");
        if (user == null || user.isBlank()) user = "investigator";
        store.audit("report:export", user, "", "dossier");
        return Report.renderDossier(service.graph(), request, store, suiteService, user);
    }
}
