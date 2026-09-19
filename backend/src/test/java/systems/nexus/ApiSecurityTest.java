package systems.nexus;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:security;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE","spring.datasource.username=sa","spring.datasource.password="})
@AutoConfigureMockMvc
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ApiSecurityTest {
    @Autowired MockMvc mvc;
    @Test void rejectsUnknownOrigins() throws Exception {
        mvc.perform(post("/api/demo/reset").header("Origin","https://untrusted.invalid").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("ORIGIN_DENIED"));
        mvc.perform(get("/api/health").header("Origin","http://localhost:8080"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://localhost:8080"));
    }
    @Test void rejectsOversizedInvalidUtf8AndMalformedBodies() throws Exception {
        mvc.perform(post("/api/demo/reset").contentType(MediaType.APPLICATION_JSON).content(new byte[2097153]))
            .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.error.code").value("TOO_LARGE"));
        mvc.perform(post("/api/data/fir").contentType(MediaType.APPLICATION_JSON).content(new byte[]{(byte)0xc3,0x28}))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_ENCODING"));
        mvc.perform(post("/api/data/fir").contentType(MediaType.APPLICATION_JSON).content("{broken"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    }
    @Autowired Store store;

    @Test void boundsMutationsAndReturnsSafeErrors() throws Exception {
        for(int i=0;i<30;i++) mvc.perform(post("/api/demo/reset").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isOk());
        mvc.perform(post("/api/demo/reset").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.error.code").value("RATE_LIMIT"))
            .andExpect(header().exists("Retry-After"))
            .andExpect(header().string("X-RateLimit-Limit", "30"))
            .andExpect(header().string("X-RateLimit-Remaining", "0"))
            .andExpect(header().exists("X-RateLimit-Reset"));
    }
    @Test void partialRowsAreIsolatedAndDuplicatesSkipped() throws Exception {
        String body="""
            {"records":[{"caseId":"TEST","from":"SYN-ACCOUNT-001","to":"SYN-ACCOUNT-002","timestamp":"2026-09-01T00:00:00Z","amount":500},{"caseId":"TEST","amount":-10}]}
            """;
        mvc.perform(post("/api/data/transactions").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.accepted").value(1)).andExpect(jsonPath("$.errors[0].row").value(2));
        mvc.perform(post("/api/data/transactions").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.duplicates").value(1)).andExpect(jsonPath("$.accepted").value(0));
        mvc.perform(get("/api/entities/missing")).andExpect(status().isNotFound()).andExpect(jsonPath("$.error.message").value("Entity not found"));
    }
    @Test void authenticationAndRbacEnforcement() throws Exception {
        // Login with valid credentials
        String loginBody = "{\"username\":\"investigator\",\"password\":\"Investigator123!\"}";
        var res = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("INVESTIGATOR"))
            .andExpect(jsonPath("$.token").isString())
            .andReturn();
        String jsonStr = res.getResponse().getContentAsString();
        String token = jsonStr.substring(jsonStr.indexOf("\"token\":\"") + 9, jsonStr.indexOf("\"", jsonStr.indexOf("\"token\":\"") + 9));

        // Authenticate via token on /api/auth/me
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("INVESTIGATOR"));

        // Login with invalid credentials
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"admin\",\"password\":\"WrongPassword\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));

        // Invalid bearer token rejected
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer bad.token.here"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));

        // VIEWER role forbidden on POST mutations
        mvc.perform(post("/api/demo/reset").header("X-Nexus-Role", "VIEWER").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

        // VIEWER bearer token forbidden on POST mutations
        mvc.perform(post("/api/demo/reset").header("Authorization", "Bearer synthetic-viewer-token").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

        // INVESTIGATOR role permitted on mutations
        mvc.perform(post("/api/demo/reset").header("X-Nexus-Role", "INVESTIGATOR").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk());
    }
    @Test void tamperEvidentAuditChain() throws Exception {
        mvc.perform(post("/api/demo/reset").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk());
        mvc.perform(post("/api/demo/reset").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk());

        // Chain is valid initially
        mvc.perform(get("/api/audit/verify"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true))
            .andExpect(jsonPath("$.entriesVerified").isNumber());

        // Tamper with an audit entry
        store.tamperAuditEntry(1, "TAMPERED_ACTION_FORGED");

        // Chain verification fails with tamper detection
        mvc.perform(get("/api/audit/verify"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false))
            .andExpect(jsonPath("$.brokenAtIndex").value(0))
            .andExpect(jsonPath("$.reason").isString());
    }
}
