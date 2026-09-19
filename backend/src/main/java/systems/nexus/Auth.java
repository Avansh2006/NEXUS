package systems.nexus;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

public class Auth {
    private static final String SECRET = "nexus-secret-key-32-bytes-long-12345";
    private static final Base64.Encoder B64ENC = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64DEC = Base64.getUrlDecoder();

    public record UserPrincipal(String username, String role) {}

    public static final Map<String, UserPrincipal> SYNTHETIC_USERS = Map.of(
        "admin", new UserPrincipal("admin@nexus.internal", "ADMIN"),
        "investigator", new UserPrincipal("officer@nexus.internal", "INVESTIGATOR"),
        "viewer", new UserPrincipal("viewer@nexus.internal", "VIEWER")
    );

    public static final Map<String, String> PASSWORDS = Map.of(
        "admin", "AdminPass123!",
        "investigator", "Investigator123!",
        "viewer", "Viewer123!"
    );

    public static String createToken(String username, String role) {
        String header = B64ENC.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = B64ENC.encodeToString(
            ("{\"sub\":\"" + username + "\",\"role\":\"" + role + "\",\"iat\":" + System.currentTimeMillis() + "}")
                .getBytes(StandardCharsets.UTF_8)
        );
        String data = header + "." + payload;
        String sig = sign(data);
        return data + "." + sig;
    }

    public static UserPrincipal authenticateToken(String token) {
        if (token == null || token.isBlank()) return null;
        if (token.startsWith("Bearer ")) token = token.substring(7).trim();

        // Synthetic tokens for quick testing
        if ("synthetic-admin-token".equals(token)) return SYNTHETIC_USERS.get("admin");
        if ("synthetic-investigator-token".equals(token)) return SYNTHETIC_USERS.get("investigator");
        if ("synthetic-viewer-token".equals(token)) return SYNTHETIC_USERS.get("viewer");

        String[] parts = token.split("\\.");
        if (parts.length != 3) return null;

        String expectedSig = sign(parts[0] + "." + parts[1]);
        if (!MessageDigest.isEqual(expectedSig.getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
            return null;
        }

        try {
            String payloadJson = new String(B64DEC.decode(parts[1]), StandardCharsets.UTF_8);
            String sub = extractJsonField(payloadJson, "sub");
            String role = extractJsonField(payloadJson, "role");
            if (sub != null && role != null) {
                return new UserPrincipal(sub, role);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return B64ENC.encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String extractJsonField(String json, String key) {
        int idx = json.indexOf("\"" + key + "\"");
        if (idx == -1) return null;
        int colon = json.indexOf(":", idx);
        if (colon == -1) return null;
        int quoteStart = json.indexOf("\"", colon);
        if (quoteStart == -1) return null;
        int quoteEnd = json.indexOf("\"", quoteStart + 1);
        if (quoteEnd == -1) return null;
        return json.substring(quoteStart + 1, quoteEnd);
    }
}
