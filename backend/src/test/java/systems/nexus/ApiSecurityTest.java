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
    @Test void boundsMutationsAndReturnsSafeErrors() throws Exception {
        for(int i=0;i<30;i++) mvc.perform(post("/api/demo/reset").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isOk());
        mvc.perform(post("/api/demo/reset").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.error.code").value("RATE_LIMIT"));
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
}
