package systems.nexus;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:authboundary;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "spring.datasource.username=sa", "spring.datasource.password="})
@AutoConfigureMockMvc
class AuthBoundaryTest extends TestCredentials {
    @Autowired MockMvc mvc;
    @Test void anonymousRequestsCannotReadInvestigation() throws Exception {
        mvc.perform(get("/api/graph")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void healthRemainsPublic() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }
}
