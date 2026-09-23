package systems.nexus;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class DatabaseConfig {
    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Value("${spring.datasource.url:}")
    private String rawUrl;

    @Value("${spring.datasource.username:}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Value("${spring.datasource.hikari.connection-timeout:5000}")
    private long connectionTimeout = 5000;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();

        if (rawUrl != null && (rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://"))) {
            try {
                URI uri = new URI(rawUrl);
                if (uri.getHost() == null || uri.getPath() == null || uri.getPath().length() < 2) {
                    throw new IllegalArgumentException("Invalid cloud database URI");
                }
                String userInfo = uri.getUserInfo();
                String user = username;
                String pass = password;
                if (userInfo != null && userInfo.contains(":")) {
                    String[] parts = userInfo.split(":", 2);
                    user = parts[0];
                    pass = parts[1];
                }
                int port = uri.getPort() > 0 ? uri.getPort() : 5432;
                String path = uri.getPath();
                String jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + port + path;

                log.info("Configuring cloud PostgreSQL DataSource");
                config.setJdbcUrl(jdbcUrl);
                config.setUsername(user);
                config.setPassword(pass);
                config.setDriverClassName("org.postgresql.Driver");
            } catch (Exception e) {
                // Neither the raw URI nor the parse exception is safe to log: both can contain credentials.
                throw new IllegalArgumentException("Invalid cloud database URI");
            }
        } else if (rawUrl != null && !rawUrl.isBlank()) {
            config.setJdbcUrl(rawUrl);
            config.setUsername(username);
            config.setPassword(password);
        } else {
            log.info("No datasource URL specified, initializing embedded in-memory H2 database (PostgreSQL mode)");
            config.setJdbcUrl("jdbc:h2:mem:nexus;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE");
            config.setUsername("sa");
            config.setPassword("");
            config.setDriverClassName("org.h2.Driver");
        }

        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(connectionTimeout);
        return new HikariDataSource(config);
    }
}
