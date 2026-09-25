package systems.nexus;

import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowService {
  private final JdbcTemplate db;
  private final Store store;

  public WorkflowService(JdbcTemplate db, Store store) {
    this.db = db;
    this.store = store;
  }

  public record Note(String id, String entityId, String text, String author, String createdAt) {}

  public record Triage(
      String alertId, String status, long version, String author, String updatedAt) {}

  public record Workflow(List<Note> notes, List<String> watchlist, List<Triage> triage) {}

  private String canonical(String id) {
    var aliases = store.state("aliases");
    var seen = new HashSet<String>();
    while (aliases.has(id) && seen.add(id)) id = aliases.path(id).asText();
    return id;
  }

  private void entity(String id) {
    if (id == null || store.graph().nodes().stream().noneMatch(n -> n.id().equals(canonical(id))))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity not found");
  }

  private Set<String> alerts() {
    Set<String> ids = new HashSet<>();
    store.graph().analysis().path("alerts").forEach(a -> ids.add(a.path("id").asText()));
    return ids;
  }

  private List<Note> allNotes() {
    return db.query(
        "SELECT id,entity_id,note_text,author,created_at FROM entity_note ORDER BY created_at,id",
        (r, n) ->
            new Note(
                r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5)));
  }

  public List<Note> notes(String id) {
    entity(id);
    return allNotes().stream().filter(n -> canonical(n.entityId()).equals(canonical(id))).toList();
  }

  public Workflow workflow(String user) {
    var active = new HashSet<String>();
    store.graph().nodes().forEach(n -> active.add(n.id()));
    return new Workflow(
        allNotes().stream().filter(n -> active.contains(canonical(n.entityId()))).toList(),
        watchlist(user),
        db
            .query(
                "SELECT alert_id,status,version,author,updated_at FROM alert_triage ORDER BY"
                    + " alert_id",
                (r, n) ->
                    new Triage(
                        r.getString(1),
                        r.getString(2),
                        r.getLong(3),
                        r.getString(4),
                        r.getString(5)))
            .stream()
            .filter(t -> alerts().contains(t.alertId()))
            .toList());
  }

  @Transactional
  public Note addNote(String id, String text, String user) {
    entity(id);
    if (text == null || text.isBlank() || text.length() > 4000)
      throw new IllegalArgumentException("Notes must contain 1–4000 characters");
    var note = new Note(UUID.randomUUID().toString(), id, text, user, Instant.now().toString());
    db.update(
        "INSERT INTO entity_note VALUES(?,?,?,?,?)", note.id(), id, text, user, note.createdAt());
    store.audit("note:create", user, id, Store.sha256(text));
    return note;
  }

  public List<String> watchlist(String user) {
    Set<String> active = new HashSet<>();
    store.graph().nodes().forEach(n -> active.add(n.id()));
    return db
        .query(
            "SELECT entity_id FROM watchlist_entry WHERE user_id=? ORDER BY entity_id",
            (r, n) -> r.getString(1),
            user)
        .stream()
        .map(this::canonical)
        .filter(active::contains)
        .distinct()
        .sorted()
        .toList();
  }

  @Transactional
  public void watch(String id, boolean watched, String user) {
    entity(id);
    String canonicalId = canonical(id); // lock a stable user row to serialize idempotent updates
    db.update("INSERT INTO workflow_user(user_id) VALUES(?) ON CONFLICT DO NOTHING", user);
    db.queryForList("SELECT user_id FROM workflow_user WHERE user_id=? FOR UPDATE", user);
    var original =
        db.query(
            "SELECT entity_id FROM watchlist_entry WHERE user_id=?",
            (r, n) -> r.getString(1),
            user);
    for (String entry : original)
      if (canonical(entry).equals(canonicalId))
        db.update("DELETE FROM watchlist_entry WHERE user_id=? AND entity_id=?", user, entry);
    if (watched) db.update("INSERT INTO watchlist_entry VALUES(?,?)", user, id);
    store.audit("watchlist:" + (watched ? "add" : "remove"), user, id, "");
  }

  @Transactional
  public Triage triage(String id, String status, long version, String user) {
    if (!alerts().contains(id))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found");
    if (!Set.of("New", "Under Review", "Verified", "Dismissed")
            .contains(status == null ? "" : status)
        || version < 0) throw new IllegalArgumentException("Invalid triage status or version");
    // The placeholder guarantees a row exists; the conditional UPDATE is the optimistic lock.
    db.update(
        "INSERT INTO alert_triage(alert_id,status,version,author,updated_at) VALUES(?,'New',0,?,?)"
            + " ON CONFLICT DO NOTHING",
        id,
        user,
        Instant.now().toString());
    String now = Instant.now().toString();
    int changed =
        db.update(
            "UPDATE alert_triage SET status=?,version=version+1,author=?,updated_at=? WHERE"
                + " alert_id=? AND version=?",
            status,
            user,
            now,
            id,
            version);
    if (changed != 1)
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Triage changed; refresh and retry");
    store.audit("alert:triage", user, id, Store.sha256(status));
    return new Triage(id, status, version + 1, user, now);
  }
}
