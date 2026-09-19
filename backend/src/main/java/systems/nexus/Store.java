package systems.nexus;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.*;

@Repository
public class Store {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public Store(JdbcTemplate db, ObjectMapper json) { this.db=db; this.json=json; }
    public String encode(Object value) { try { return json.writeValueAsString(value); } catch(JsonProcessingException e) { throw new IllegalStateException(e); } }
    public JsonNode decode(String value) { try { JsonNode n=json.readTree(value); return n.isTextual()?json.readTree(n.asText()):n; } catch(JsonProcessingException e) { throw new IllegalStateException(e); } }
    public List<Model.Source> sources() { return db.query("SELECT id,kind,payload FROM source_record ORDER BY id", (rs,n)->new Model.Source(rs.getString(1),rs.getString(2),decode(rs.getString(3)))); }
    public boolean exists(String hash) { return db.queryForObject("SELECT COUNT(*) FROM source_record WHERE content_hash=?",Integer.class,hash)>0; }
    public void source(String id,String kind,String hash,JsonNode payload) { db.update("INSERT INTO source_record VALUES(?,?,?,CAST(? AS JSONB))",id,kind,hash,encode(payload)); }
    public JsonNode state(String id) { var rows=db.query("SELECT payload FROM app_state WHERE id=?",(rs,n)->decode(rs.getString(1)),id); return rows.isEmpty()?json.createObjectNode():rows.get(0); }
    public void state(String id,Object payload) { db.update("DELETE FROM app_state WHERE id=?",id); db.update("INSERT INTO app_state VALUES(?,CAST(? AS JSONB))",id,encode(payload)); }
    public void persist(Model.Graph g) {
        db.update("DELETE FROM evidence"); db.update("DELETE FROM edge"); db.update("DELETE FROM node");
        for(var n:g.nodes()) db.update("INSERT INTO node VALUES(?,?,?,CAST(? AS JSONB))",n.id(),n.type(),n.label(),encode(n.properties()));
        for(var e:g.edges()) db.update("INSERT INTO edge VALUES(?,?,?,?,CAST(? AS JSONB))",e.id(),e.source(),e.target(),e.type(),encode(e.properties()));
        for(var e:g.evidence()) db.update("INSERT INTO evidence VALUES(?,?,?,?,CAST(? AS JSONB))",e.id(),e.recordId(),e.entityId(),e.edgeId(),encode(e));
        state("graph",g);
    }
    public Model.Graph graph() {
        JsonNode n=state("graph");
        if(!n.has("nodes")) return new Model.Graph(List.of(),List.of(),List.of(),List.of(),json.createObjectNode(),false,List.of());
        try { return json.treeToValue(n,Model.Graph.class); } catch(JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    public void reset() { db.update("DELETE FROM evidence"); db.update("DELETE FROM edge"); db.update("DELETE FROM node"); db.update("DELETE FROM source_record"); db.update("DELETE FROM app_state"); }
    public void deleteSourcesByCaseId(String caseId) {
        var list = sources();
        for (var s : list) {
            if (caseId.equals(s.payload().path("caseId").asText())) {
                db.update("DELETE FROM evidence WHERE record_id=?", s.id());
                db.update("DELETE FROM source_record WHERE id=?", s.id());
            }
        }
    }

    public static String sha256(String input) {
        try {
            var md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            var sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch(Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public synchronized void audit(String action, String userId, String entityId, String payloadDigest) {
        String prevHash = db.query(
            "SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1",
            (rs, n) -> rs.getString(1)
        ).stream().findFirst().orElse("0".repeat(64));
        String ts = Instant.now().toString();
        String u = (userId == null || userId.isBlank()) ? "system" : userId;
        String ent = entityId == null ? "" : entityId;
        String dig = payloadDigest == null ? "" : payloadDigest;
        String hash = sha256(prevHash + ts + u + action + ent + dig);
        db.update(
            "INSERT INTO audit_log(action, created_at, user_id, entity_id, payload_digest, prev_hash, entry_hash) VALUES(?,?,?,?,?,?,?)",
            action, ts, u, ent, dig, prevHash, hash
        );
    }

    public void audit(String action) {
        audit(action, "system", "", "");
    }

    public List<Map<String,Object>> audit() {
        return db.query(
            "SELECT id, action, created_at, user_id, entity_id, payload_digest, prev_hash, entry_hash FROM audit_log ORDER BY id DESC LIMIT 200",
            (rs, n) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", rs.getLong(1));
                m.put("action", rs.getString(2));
                m.put("createdAt", rs.getString(3));
                m.put("userId", rs.getString(4));
                m.put("entityId", rs.getString(5));
                m.put("payloadDigest", rs.getString(6));
                m.put("prevHash", rs.getString(7));
                m.put("entryHash", rs.getString(8));
                return m;
            }
        );
    }

    public record AuditRow(long id, String action, String createdAt, String userId, String entityId, String payloadDigest, String prevHash, String entryHash) {}

    public Map<String, Object> verifyAuditChain() {
        var rows = db.query(
            "SELECT id, action, created_at, user_id, entity_id, payload_digest, prev_hash, entry_hash FROM audit_log ORDER BY id ASC",
            (rs, n) -> new AuditRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8))
        );
        String expectedPrev = "0".repeat(64);
        for (int i = 0; i < rows.size(); i++) {
            AuditRow r = rows.get(i);
            if (!r.prevHash().equals(expectedPrev)) {
                return Map.of(
                    "valid", false,
                    "brokenAtIndex", i,
                    "expectedPrevHash", expectedPrev,
                    "actualPrevHash", r.prevHash(),
                    "reason", "Broken hash linkage at index " + i
                );
            }
            String computed = sha256(r.prevHash() + r.createdAt() + r.userId() + r.action() + r.entityId() + r.payloadDigest());
            if (!computed.equals(r.entryHash())) {
                return Map.of(
                    "valid", false,
                    "brokenAtIndex", i,
                    "computedHash", computed,
                    "storedEntryHash", r.entryHash(),
                    "reason", "Hash tampering detected at index " + i
                );
            }
            expectedPrev = r.entryHash();
        }
        return Map.of(
            "valid", true,
            "entriesVerified", rows.size(),
            "headHash", expectedPrev
        );
    }

    public void tamperAuditEntry(long id, String tamperedAction) {
        db.update("UPDATE audit_log SET action=? WHERE id=?", tamperedAction, id);
    }
}
