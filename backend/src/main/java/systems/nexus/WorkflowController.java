package systems.nexus;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class WorkflowController {
  private final WorkflowService service;

  public WorkflowController(WorkflowService service) {
    this.service = service;
  }

  private String user(HttpServletRequest req) {
    return (String) req.getAttribute("nexus.user");
  }

  public record NoteRequest(String text) {}

  public record WatchRequest(Boolean watched) {}

  public record TriageRequest(String status, Long version) {}

  @GetMapping("/workflow")
  public WorkflowService.Workflow workflow(HttpServletRequest req) {
    return service.workflow(user(req));
  }

  @GetMapping("/entities/{id}/notes")
  public List<WorkflowService.Note> notes(@PathVariable String id) {
    return service.notes(id);
  }

  @PostMapping("/entities/{id}/notes")
  public WorkflowService.Note note(
      @PathVariable String id, @RequestBody NoteRequest body, HttpServletRequest req) {
    return service.addNote(id, body.text(), user(req));
  }

  @GetMapping("/watchlist")
  public List<String> watchlist(HttpServletRequest req) {
    return service.watchlist(user(req));
  }

  @PostMapping("/entities/{id}/watchlist")
  public Map<String, Boolean> watch(
      @PathVariable String id, @RequestBody WatchRequest body, HttpServletRequest req) {
    if (body.watched() == null) throw new IllegalArgumentException("watched is required");
    service.watch(id, body.watched(), user(req));
    return Map.of("watched", body.watched());
  }

  @PostMapping("/alerts/{id}/triage")
  public WorkflowService.Triage triage(
      @PathVariable String id, @RequestBody TriageRequest body, HttpServletRequest req) {
    if (body.version() == null) throw new IllegalArgumentException("version is required");
    return service.triage(id, body.status(), body.version(), user(req));
  }
}
