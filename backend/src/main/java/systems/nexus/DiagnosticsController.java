package systems.nexus;

import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

/** RequestGuard restricts this endpoint to authenticated administrators. */
@RestController
public class DiagnosticsController {
    private final JdbcTemplate database;
    private final EngineClient engine;
    public DiagnosticsController(JdbcTemplate database,EngineClient engine) { this.database=database;this.engine=engine; }

    @GetMapping("/api/diagnostics")
    public Map<String,Object> diagnostics() {
        boolean databaseReady=false,engineReady=false; String engineVersion="unavailable";
        try {
            databaseReady=Boolean.TRUE.equals(database.execute((ConnectionCallback<Boolean>)connection->{
                try(var statement=connection.createStatement()) {
                    statement.setQueryTimeout(3);
                    try(var result=statement.executeQuery("SELECT 1")) { return result.next() && result.getInt(1)==1; }
                }
            }));
        } catch(RuntimeException ignored) { /* Return availability only, never connection details. */ }
        try {
            var health=engine.health();
            engineReady=health!=null && health.path("status").asText().equals("ok");
            if(engineReady) {
                String version=health.path("version").asText("unknown");
                engineVersion=version.matches("[A-Za-z0-9.+_-]{1,64}")?version:"unknown";
            }
        } catch(RuntimeException ignored) { /* No sidecar response or transport details are exposed. */ }
        return Map.of("status",databaseReady&&engineReady?"ok":"degraded",
                "database",Map.of("status",databaseReady?"ok":"unavailable"),
                "intelligence",Map.of("status",engineReady?"ok":"unavailable"),
                "versions",Map.of("java",System.getProperty("java.version"),"api","0.1.0","intelligence",engineVersion));
    }
}
