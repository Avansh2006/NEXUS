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
    public void audit(String action) { db.update("INSERT INTO audit_log(action,created_at) VALUES(?,?)",action,Instant.now().toString()); }
    public List<Map<String,Object>> audit() { return db.query("SELECT action,created_at FROM audit_log ORDER BY id DESC LIMIT 200",(rs,n)->Map.of("action",rs.getString(1),"createdAt",rs.getString(2))); }
}
