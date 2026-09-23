package systems.nexus;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.http.MediaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:security;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE","spring.datasource.username=sa","spring.datasource.password="})
@AutoConfigureMockMvc
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ApiSecurityTest extends TestCredentials {
    @Autowired MockMvc mvc;
    @Autowired Store store;
    @Autowired Auth auth;
    @Autowired ObjectMapper json;
    private String bearer(String user) {return "Bearer "+auth.createToken(user,user.toUpperCase(java.util.Locale.ROOT));}
    private MockHttpServletRequestBuilder postAs(String path,String user) {return post(path).header("Authorization",bearer(user)).contentType(MediaType.APPLICATION_JSON);}

    @Test void rejectsUnknownOriginsAndAssignsRequestId() throws Exception {
        mvc.perform(postAs("/api/demo/reset","admin").header("Origin","https://untrusted.invalid").content("{}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("ORIGIN_DENIED"));
        mvc.perform(get("/api/health").header("Origin","http://localhost:8080"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://localhost:8080"))
            .andExpect(header().exists("X-Request-ID"));
    }
    @Test void rejectsOversizedInvalidUtf8AndMalformedBodies() throws Exception {
        mvc.perform(postAs("/api/demo/reset","admin").content(new byte[2097153]))
            .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.error.code").value("TOO_LARGE"));
        mvc.perform(postAs("/api/data/fir","investigator").content(new byte[]{(byte)0xc3,0x28}))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_ENCODING"));
        mvc.perform(postAs("/api/data/fir","investigator").content("{broken"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    }
    @Test void boundsMutations() throws Exception {
        for(int i=0;i<30;i++) mvc.perform(postAs("/api/demo/reset","admin").content("{}")).andExpect(status().isOk());
        mvc.perform(postAs("/api/demo/reset","admin").content("{}"))
            .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"))
            .andExpect(header().string("X-RateLimit-Limit","30")).andExpect(header().string("X-RateLimit-Remaining","0"));
    }
    @Test void partialRowsAreIsolatedAndDuplicatesSkipped() throws Exception {
        String body="""
            {"records":[{"caseId":"TEST","from":"SYN-ACCOUNT-001","to":"SYN-ACCOUNT-002","timestamp":"2026-09-01T00:00:00Z","amount":500},{"caseId":"TEST","amount":-10}]}
            """;
        mvc.perform(postAs("/api/data/transactions","investigator").content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.accepted").value(1)).andExpect(jsonPath("$.errors[0].row").value(2));
        mvc.perform(postAs("/api/data/transactions","investigator").content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.duplicates").value(1));
        mvc.perform(get("/api/entities/missing").header("Authorization",bearer("viewer"))).andExpect(status().isNotFound());
    }
    @Test void realLoginAndRolePermissions() throws Exception {
        var login=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(java.util.Map.of("username","investigator","password",PASSWORD))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("INVESTIGATOR"))
            .andExpect(jsonPath("$.expiresAt").isString()).andReturn();
        String token=json.readTree(login.getResponse().getContentAsString()).path("token").asText();
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("investigator"));
        mvc.perform(postAs("/api/demo/reset","investigator").content("{}")).andExpect(status().isForbidden());
        mvc.perform(postAs("/api/data/transactions","viewer").content("{}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/diagnostics").header("Authorization",bearer("viewer"))).andExpect(status().isForbidden());
        mvc.perform(postAs("/api/reports","viewer").content("{}")).andExpect(status().isOk());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"admin\",\"password\":\"wrong\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer invalid")).andExpect(status().isUnauthorized());
    }
    @Test void auditIsAttributedAndTamperEvident() throws Exception {
        mvc.perform(postAs("/api/demo/reset","admin").content("{}")).andExpect(status().isOk());
        mvc.perform(get("/api/audit").header("Authorization",bearer("admin")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].userId").value("admin"));
        mvc.perform(get("/api/audit/verify").header("Authorization",bearer("admin")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
        store.tamperAuditEntry(1,"tampered test fixture");
        mvc.perform(get("/api/audit/verify").header("Authorization",bearer("admin")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(false));
    }
    @Test void invalidParametersAndMethodsHaveClientErrorStatus() throws Exception {
        mvc.perform(get("/api/network/missing").param("hops","invalid").header("Authorization",bearer("viewer")))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/graph").header("Authorization",bearer("admin")))
            .andExpect(status().isMethodNotAllowed());
    }
    @Test void loginAttemptsAreRateLimited() throws Exception {
        for(int i=0;i<30;i++) mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"admin\",\"password\":\"incorrect\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
    }
}
