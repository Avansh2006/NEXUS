package systems.nexus;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class AuthTest extends TestCredentials {
    private final Auth auth=new Auth(SECRET,HASH,HASH,HASH,3600);
    @Test void validLoginAndExpiryAreChecked() {
        var login=auth.login("viewer",PASSWORD);
        assertEquals("VIEWER",auth.authenticateToken("Bearer "+login.get("token")).role());
        var expired=JWT.create().withIssuer(Auth.ISSUER).withSubject("viewer").withClaim("role","VIEWER")
            .withIssuedAt(Instant.now().minusSeconds(120)).withExpiresAt(Instant.now().minusSeconds(60)).sign(Algorithm.HMAC256(SECRET));
        assertNull(auth.authenticateToken("Bearer "+expired));
    }
    @Test void requiredClaimsAndConfiguredAccountsAreEnforced() {
        assertNull(auth.authenticateToken("Bearer "+JWT.create().withIssuer(Auth.ISSUER).withSubject("viewer")
            .withClaim("role","VIEWER").sign(Algorithm.HMAC256(SECRET))));
        assertThrows(IllegalArgumentException.class,()->auth.createToken("viewer","ADMIN"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->auth.login("unknown",PASSWORD));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->auth.login("admin","incorrect"));
        assertThrows(IllegalStateException.class,()->new Auth("short",HASH,HASH,HASH,3600));
        assertThrows(IllegalStateException.class,()->new Auth(SECRET,"",HASH,HASH,3600));
    }
    @Test void issuerSignatureAndRoleClaimsMustMatchConfiguration() {
        Instant now=Instant.now();
        var wrongIssuer=JWT.create().withIssuer("another-test-app").withSubject("viewer").withClaim("role","VIEWER")
            .withIssuedAt(now).withExpiresAt(now.plusSeconds(60)).sign(Algorithm.HMAC256(SECRET));
        var wrongKey=JWT.create().withIssuer(Auth.ISSUER).withSubject("viewer").withClaim("role","VIEWER")
            .withIssuedAt(now).withExpiresAt(now.plusSeconds(60)).sign(Algorithm.HMAC256("another-test-key-never-deployed-1234567890"));
        var wrongRole=JWT.create().withIssuer(Auth.ISSUER).withSubject("viewer").withClaim("role","ADMIN")
            .withIssuedAt(now).withExpiresAt(now.plusSeconds(60)).sign(Algorithm.HMAC256(SECRET));
        assertNull(auth.authenticateToken("Bearer "+wrongIssuer));
        assertNull(auth.authenticateToken("Bearer "+wrongKey));
        assertNull(auth.authenticateToken("Bearer "+wrongRole));
    }
}
