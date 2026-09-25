package systems.nexus;

import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class GraphToolsController {
  private final Store store;

  public GraphToolsController(Store store) {
    this.store = store;
  }

  public record RemoveRequest(List<String> entityIds) {}

  @PostMapping("/what-if/remove")
  public GraphTools.Simulation remove(@RequestBody RemoveRequest body) {
    return GraphTools.remove(store.graph(), body.entityIds());
  }

  private ResponseEntity<String> download(String filename, String type, String content) {
    store.audit("export:" + filename);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .contentType(MediaType.parseMediaType(type + ";charset=UTF-8"))
        .body(content);
  }

  @GetMapping("/exports/nodes.csv")
  public ResponseEntity<String> nodes() {
    return download("nodes.csv", "text/csv", GraphTools.nodesCsv(store.graph()));
  }

  @GetMapping("/exports/edges.csv")
  public ResponseEntity<String> edges() {
    return download("edges.csv", "text/csv", GraphTools.edgesCsv(store.graph()));
  }

  @GetMapping("/exports/graph.graphml")
  public ResponseEntity<String> graph() {
    return download("graph.graphml", "application/graphml+xml", GraphTools.graphml(store.graph()));
  }
}
