package systems.nexus;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(OutputCaptureExtension.class)
class DatabaseConfigTest {
    @Test void malformedCloudUriFailsWithoutLeakingCredentials(CapturedOutput output) {
        var config = new DatabaseConfig();
        ReflectionTestUtils.setField(config, "rawUrl", "postgres://private:secret-password@bad host/db");
        assertThatThrownBy(config::dataSource)
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("Invalid cloud database URI")
            .hasNoCause();
        assertThat(output.getAll()).doesNotContain("secret-password", "private:");
    }

    @Test void datasourceUsesConfiguredConnectionTimeout() {
        var config = new DatabaseConfig();
        ReflectionTestUtils.setField(config, "rawUrl", "jdbc:h2:mem:config_timeout");
        ReflectionTestUtils.setField(config, "connectionTimeout", 1500L);
        try (var datasource = (HikariDataSource) config.dataSource()) {
            assertThat(datasource.getConnectionTimeout()).isEqualTo(1500L);
        }
    }
}
