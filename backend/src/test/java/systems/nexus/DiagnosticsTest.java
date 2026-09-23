package systems.nexus;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DiagnosticsTest {
    final ObjectMapper json=new ObjectMapper();
    @Test void checksDatabaseAndEngineSeparately() {
        var db=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:diagnostics","sa",""));
        EngineClient engine=mock(EngineClient.class);
        when(engine.health()).thenReturn(json.createObjectNode().put("status","ok").put("version","0.1.0"));
        var diagnostics=new DiagnosticsController(db,engine);
        assertThat(diagnostics.diagnostics()).containsEntry("status","ok");
        when(engine.health()).thenThrow(new IllegalStateException("secret connection string"));
        var failed=diagnostics.diagnostics();
        assertThat(failed).containsEntry("status","degraded");
        assertThat(failed.toString()).contains("unavailable").doesNotContain("secret");
    }
    @Test void reachableButUnhealthySidecarIsNotReady() {
        var db=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:diagnostics2","sa",""));
        EngineClient engine=mock(EngineClient.class);
        when(engine.health()).thenReturn(json.createObjectNode().put("status","degraded"));
        assertThat(new DiagnosticsController(db,engine).diagnostics()).containsEntry("status","degraded");
    }
    @Test void databaseFailureIsReportedWithoutDetails() {
        var db=new JdbcTemplate(new DriverManagerDataSource("jdbc:missing:secret","private","password"));
        EngineClient engine=mock(EngineClient.class);
        when(engine.health()).thenReturn(json.createObjectNode().put("status","ok"));
        var result=new DiagnosticsController(db,engine).diagnostics();
        assertThat(result).containsEntry("status","degraded");
        assertThat(result.toString()).doesNotContain("secret","password","private");
    }
}
