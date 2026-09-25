package systems.nexus;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Test fixture only: application deployments require separate environment secrets. */
public abstract class TestCredentials {
    public static final String PASSWORD="Test-password-only-2026!";
    static final String SECRET="test-only-signing-secret-not-used-by-deployments-2026";
    static final String HASH=new BCryptPasswordEncoder(10).encode(PASSWORD);
    @DynamicPropertySource
    static void authProperties(DynamicPropertyRegistry registry) {
        registry.add("nexus.auth.secret",()->SECRET);
        registry.add("nexus.auth.admin-hash",()->HASH);
        registry.add("nexus.auth.investigator-hash",()->HASH);
        registry.add("nexus.auth.viewer-hash",()->HASH);
    }
}
