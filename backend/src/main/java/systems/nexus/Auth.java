package systems.nexus;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/** Explicit prototype accounts with externally configured password hashes. */
@Component
public class Auth {
    static final String ISSUER = "nexus-prototype";
    private final Algorithm algorithm;
    private final JWTVerifier verifier;
    private final Map<String,String> hashes;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final int ttl;
    private static final Map<String,String> ROLES = Map.of("admin","ADMIN", "investigator","INVESTIGATOR", "viewer","VIEWER");
    public record UserPrincipal(String username, String role) {}

    public Auth(@Value("${nexus.auth.secret:}") String secret,
                @Value("${nexus.auth.admin-hash:}") String admin,
                @Value("${nexus.auth.investigator-hash:}") String investigator,
                @Value("${nexus.auth.viewer-hash:}") String viewer,
                @Value("${nexus.auth.ttl-seconds:3600}") int ttl) {
        if(secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalStateException("Configure NEXUS_JWT_SECRET with at least 32 random bytes");
        hashes = Map.of("admin", admin, "investigator", investigator, "viewer", viewer);
        for(String hash:hashes.values()) if(!hash.matches("\\$2[aby]\\$(?:1[0-6])\\$[./A-Za-z0-9]{53}"))
            throw new IllegalStateException("Configure all NEXUS_*_PASSWORD_HASH values with BCrypt cost 10–16");
        if(ttl < 60 || ttl > 86400) throw new IllegalStateException("Token lifetime must be 60–86400 seconds");
        this.ttl=ttl;
        algorithm=Algorithm.HMAC256(secret);
        verifier=JWT.require(algorithm).withIssuer(ISSUER)
            .withClaimPresence("exp").withClaimPresence("iat").withClaimPresence("sub").withClaimPresence("role").build();
    }

    public Map<String,Object> login(String username, String password) {
        String user=username==null?"":username.trim().toLowerCase(Locale.ROOT);
        String value=password==null?"":password;
        if(user.length()>80 || value.getBytes(StandardCharsets.UTF_8).length>72 || value.isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid credentials");
        boolean matches=passwords.matches(value,hashes.getOrDefault(user,hashes.get("admin")));
        if(!ROLES.containsKey(user)||!matches) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid credentials");
        String token=createToken(user,ROLES.get(user));
        return Map.of("token",token,"username",user,"role",ROLES.get(user),
            "expiresAt",JWT.decode(token).getExpiresAtAsInstant().toString());
    }

    public String createToken(String username,String role) {
        if(!Objects.equals(ROLES.get(username),role)) throw new IllegalArgumentException("Unknown account or role");
        Instant now=Instant.now();
        return JWT.create().withIssuer(ISSUER).withSubject(username).withClaim("role",role)
            .withIssuedAt(now).withExpiresAt(now.plusSeconds(ttl)).withJWTId(UUID.randomUUID().toString()).sign(algorithm);
    }

    public UserPrincipal authenticateToken(String header) {
        if(header==null||!header.startsWith("Bearer ")||header.length()>8192) return null;
        try {
            var token=verifier.verify(header.substring(7).trim());
            String user=token.getSubject(),role=token.getClaim("role").asString();
            if(user==null||role==null||!Objects.equals(ROLES.get(user),role)) return null;
            if(token.getIssuedAtAsInstant().isAfter(Instant.now().plusSeconds(5))) return null;
            return new UserPrincipal(user,role);
        } catch(JWTVerificationException|IllegalArgumentException e) {return null;}
    }
}
