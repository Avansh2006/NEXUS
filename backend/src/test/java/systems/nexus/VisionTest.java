package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static systems.nexus.Model.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:vision_test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "nexus.vision.similarity-threshold=0.60"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class VisionTest extends TestCredentials {
    @Autowired MockMvc mvc;
    @Autowired Store store;
    @Autowired Auth auth;
    @Autowired ObjectMapper json;
    @Autowired VisionService visionService;
    @MockBean EngineClient engine;

    private String bearer(String user) {
        return "Bearer " + auth.createToken(user, user.toUpperCase(Locale.ROOT));
    }

    private JsonNode createEmbedding(double... values) {
        var arr = json.createArrayNode();
        for (double v : values) arr.add(v);
        return arr;
    }

    @BeforeEach
    void setup() {
        store.reset();

        // Seed a minimal graph with Person, Phone, Vehicle, Case, and Alerts
        Node personA = new Node("person_aariv", "Person", "Aariv Veylan", Map.of(
                "roles", List.of("Accused"),
                "caseIds", List.of("NXS-001", "NXS-002"),
                "corroboration", "HIGH"
        ));
        Node personB = new Node("person_mira", "Person", "Mira Solven", Map.of(
                "roles", List.of("Co-accused"),
                "caseIds", List.of("NXS-002")
        ));
        Node phoneNode = new Node("phone_001", "Phone", "SYN-PHONE-001", Map.of());
        Node vehicleNode = new Node("veh_001", "Vehicle", "ZZ00NX0001", Map.of());

        Edge e1 = new Edge("e1", "person_aariv", "phone_001", "OWNS_PHONE", Map.of());
        Edge e2 = new Edge("e2", "person_aariv", "veh_001", "OPERATES", Map.of());
        Edge e3 = new Edge("e3", "person_aariv", "person_mira", "CO_ACCUSED", Map.of());

        JsonNode analysis = json.createObjectNode()
                .set("alerts", json.createArrayNode().add(json.createObjectNode()
                        .put("id", "alert_01")
                        .put("suppressed", false)
                        .set("entityIds", json.createArrayNode().add("person_aariv"))
                ));

        store.persist(new Graph(
                List.of(personA, personB, phoneNode, vehicleNode),
                List.of(e1, e2, e3),
                List.of(),
                List.of(),
                analysis,
                true,
                List.of()
        ));
    }

    @Test
    void testCosineSimilarityComputation() {
        JsonNode v1 = createEmbedding(1.0, 0.0, 0.0);
        JsonNode v2 = createEmbedding(1.0, 0.0, 0.0);
        JsonNode v3 = createEmbedding(0.0, 1.0, 0.0);
        JsonNode v4 = createEmbedding(-1.0, 0.0, 0.0);

        assertEquals(1.0, VisionService.cosineSimilarity(v1, v2), 1e-6);
        assertEquals(0.0, VisionService.cosineSimilarity(v1, v3), 1e-6);
        assertEquals(-1.0, VisionService.cosineSimilarity(v1, v4), 1e-6);
        assertEquals(0.0, VisionService.cosineSimilarity(null, v1), 1e-6);
    }

    @Test
    void testFaceEnrollmentWorkflowAndAudit() throws Exception {
        byte[] dummyImg = new byte[]{1, 2, 3, 4, 5};
        var engineEnrollResp = json.createObjectNode()
                .put("image_hash", "hash_aariv_ref")
                .put("model_name", "adaface_ir101_webface12m")
                .put("model_version", "1.0.0")
                .put("thumbnail", "data:image/jpeg;base64,thumb123");
        engineEnrollResp.set("embedding", createEmbedding(0.6, 0.8));
        engineEnrollResp.set("quality", json.createObjectNode().put("overall_quality", 0.95));

        when(engine.visionEnroll(any(byte[].class))).thenReturn(engineEnrollResp);

        MockMultipartFile file = new MockMultipartFile("file", "aariv_ref.jpg", "image/jpeg", dummyImg);

        mvc.perform(multipart("/api/persons/person_aariv/faces")
                        .file(file)
                        .header("Authorization", bearer("investigator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personNodeId").value("person_aariv"))
                .andExpect(jsonPath("$.imageHash").value("hash_aariv_ref"))
                .andExpect(jsonPath("$.modelName").value("adaface_ir101_webface12m"));

        // Verify stored in DB
        List<PersonFace> faces = store.facesForPerson("person_aariv");
        assertEquals(1, faces.size());
        assertEquals("person_aariv", faces.get(0).personNodeId());

        // Verify audit log
        var audits = store.audit();
        boolean hasEnrollAudit = audits.stream()
                .anyMatch(a -> "vision:enroll".equals(a.get("action")) && "person_aariv".equals(a.get("entityId")));
        assertTrue(hasEnrollAudit, "Audit record for vision:enroll must be created");
        assertTrue((Boolean) store.verifyAuditChain().get("valid"));
    }

    @Test
    void testFaceEnrollmentRejectsNonExistentPerson() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "unknown.jpg", "image/jpeg", new byte[]{1, 2});
        mvc.perform(multipart("/api/persons/person_missing/faces")
                        .file(file)
                        .header("Authorization", bearer("investigator")))
                .andExpect(status().isNotFound());
    }

    @Test
    void testSearchAndContextResolution() throws Exception {
        // First enroll person_aariv directly
        PersonFace enrolledFace = new PersonFace(
                "face_aariv_01",
                "person_aariv",
                "hash_aariv",
                createEmbedding(1.0, 0.0),
                "adaface_ir101_webface12m",
                "1.0.0",
                Instant.now().toString(),
                "",
                0.92,
                json.createObjectNode().put("thumbnail", "data:image/jpeg;base64,photo_aariv")
        );
        store.addFace(enrolledFace);

        // Also enroll person_mira with orthogonal vector
        PersonFace miraFace = new PersonFace(
                "face_mira_01",
                "person_mira",
                "hash_mira",
                createEmbedding(0.0, 1.0),
                "adaface_ir101_webface12m",
                "1.0.0",
                Instant.now().toString(),
                "",
                0.88,
                json.createObjectNode().put("thumbnail", "data:image/jpeg;base64,photo_mira")
        );
        store.addFace(miraFace);

        // Query vector close to Aariv (e.g. [0.95, 0.05])
        var engineSearchResp = json.createObjectNode()
                .put("status", "FACE_EXTRACTED")
                .put("faces_detected", 1)
                .put("model_name", "adaface_ir101_webface12m")
                .put("aligned_thumbnail", "data:image/jpeg;base64,query_thumb");
        engineSearchResp.set("embedding", createEmbedding(0.95, 0.05));
        engineSearchResp.set("quality", json.createObjectNode().put("sharpness", 0.85));

        when(engine.visionSearch(any(byte[].class), any(), anyDouble())).thenReturn(engineSearchResp);

        MockMultipartFile queryFile = new MockMultipartFile("file", "cctv_suspect.jpg", "image/jpeg", new byte[]{10, 20, 30});

        mvc.perform(multipart("/api/vision/search")
                        .file(queryFile)
                        .param("threshold", "0.60")
                        .header("Authorization", bearer("investigator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("MATCH_CANDIDATE"))
                .andExpect(jsonPath("$.facesDetected").value(1))
                .andExpect(jsonPath("$.matches[0].personNodeId").value("person_aariv"))
                .andExpect(jsonPath("$.matches[0].person.label").value("Aariv Veylan"))
                .andExpect(jsonPath("$.matches[0].person.phones[0]").value("SYN-PHONE-001"))
                .andExpect(jsonPath("$.matches[0].person.vehicles[0]").value("ZZ00NX0001"))
                .andExpect(jsonPath("$.matches[0].person.cases[0]").value("NXS-001"))
                .andExpect(jsonPath("$.matches[0].person.activeAlertsCount").value(1));

        // Verify audit log for search
        var audits = store.audit();
        boolean hasSearchAudit = audits.stream()
                .anyMatch(a -> "vision:search".equals(a.get("action")));
        assertTrue(hasSearchAudit);
    }

    @Test
    void testSearchThresholdFiltersOutNonMatches() throws Exception {
        // Enroll Aariv
        store.addFace(new PersonFace(
                "face_aariv_01",
                "person_aariv",
                "hash_aariv",
                createEmbedding(1.0, 0.0),
                "adaface_ir101_webface12m",
                "1.0.0",
                Instant.now().toString(),
                "",
                0.90,
                json.createObjectNode()
        ));

        // Query vector is dissimilar (0.0, 1.0)
        var engineSearchResp = json.createObjectNode()
                .put("status", "FACE_EXTRACTED")
                .put("faces_detected", 1)
                .put("model_name", "adaface_ir101_webface12m");
        engineSearchResp.set("embedding", createEmbedding(0.0, 1.0));

        when(engine.visionSearch(any(byte[].class), any(), anyDouble())).thenReturn(engineSearchResp);

        MockMultipartFile queryFile = new MockMultipartFile("file", "unknown.jpg", "image/jpeg", new byte[]{5, 6});

        mvc.perform(multipart("/api/vision/search")
                        .file(queryFile)
                        .param("threshold", "0.60")
                        .header("Authorization", bearer("investigator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_MATCH"))
                .andExpect(jsonPath("$.matches").isEmpty());
    }

    @Test
    void testDecisionRecordingAndAuditTrail() throws Exception {
        String decisionPayload = """
                {
                    "personNodeId": "person_aariv",
                    "decision": "CONFIRMED",
                    "similarity": 0.84,
                    "modelName": "adaface_ir101_webface12m",
                    "imageHash": "hash_cctv_frame_104",
                    "notes": "Positive match confirmed against FIR NXS-001 witness description"
                }
                """;

        mvc.perform(post("/api/vision/decisions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(decisionPayload)
                        .header("Authorization", bearer("investigator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personNodeId").value("person_aariv"))
                .andExpect(jsonPath("$.decision").value("CONFIRMED"))
                .andExpect(jsonPath("$.similarity").value(0.84))
                .andExpect(jsonPath("$.author").value("investigator"));

        // Verify stored in DB
        List<FaceDecision> decisions = store.faceDecisionsForPerson("person_aariv");
        assertEquals(1, decisions.size());
        assertEquals("CONFIRMED", decisions.get(0).decision());
        assertEquals("investigator", decisions.get(0).author());

        // Verify tamper-evident audit record
        var audits = store.audit();
        boolean hasDecisionAudit = audits.stream()
                .anyMatch(a -> "vision:decision:confirmed".equals(a.get("action")) && "person_aariv".equals(a.get("entityId")));
        assertTrue(hasDecisionAudit);
        assertTrue((Boolean) store.verifyAuditChain().get("valid"));
    }

    @Test
    void testCandidateMatchingIntegrity_NoAutoMerge() throws Exception {
        // Verify that confirming a face candidate match NEVER modifies GraphBuilder nodes
        int initialNodeCount = store.graph().nodes().size();

        String decisionPayload = """
                {
                    "personNodeId": "person_aariv",
                    "decision": "CONFIRMED",
                    "similarity": 0.91,
                    "modelName": "adaface_ir101_webface12m",
                    "imageHash": "hash_cctv_test",
                    "notes": "Investigator manual confirmation"
                }
                """;

        mvc.perform(post("/api/vision/decisions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(decisionPayload)
                        .header("Authorization", bearer("investigator")))
                .andExpect(status().isOk());

        // Person nodes must remain unmerged
        int postNodeCount = store.graph().nodes().size();
        assertEquals(initialNodeCount, postNodeCount, "Face decision must NEVER automatically merge Person nodes in the graph");
    }

    @Test
    void testRbacPermissionsOnVisionEndpoints() throws Exception {
        // Viewer CAN perform visual search (query)
        var engineSearchResp = json.createObjectNode()
                .put("status", "NO_FACE_DETECTED")
                .put("faces_detected", 0)
                .put("model_name", "adaface_ir101_webface12m");
        when(engine.visionSearch(any(byte[].class), any(), anyDouble())).thenReturn(engineSearchResp);

        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", new byte[]{1, 2, 3});

        mvc.perform(multipart("/api/vision/search")
                        .file(file)
                        .header("Authorization", bearer("viewer")))
                .andExpect(status().isOk());

        // Viewer CANNOT enroll face (mutation) -> 403 Forbidden
        mvc.perform(multipart("/api/persons/person_aariv/faces")
                        .file(file)
                        .header("Authorization", bearer("viewer")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

        // Viewer CANNOT record decision (mutation) -> 403 Forbidden
        String decisionPayload = """
                {"personNodeId": "person_aariv", "decision": "CONFIRMED", "similarity": 0.8}
                """;
        mvc.perform(post("/api/vision/decisions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(decisionPayload)
                        .header("Authorization", bearer("viewer")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

        // Unauthenticated request -> 401 Unauthorized
        mvc.perform(post("/api/vision/decisions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(decisionPayload))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void testDeleteFaceRecord() throws Exception {
        PersonFace face = new PersonFace(
                "face_to_del",
                "person_aariv",
                "hash_del",
                createEmbedding(1.0, 0.0),
                "adaface_ir101_webface12m",
                "1.0.0",
                Instant.now().toString(),
                "",
                0.90,
                json.createObjectNode()
        );
        store.addFace(face);
        assertEquals(1, store.facesForPerson("person_aariv").size());

        mvc.perform(delete("/api/persons/person_aariv/faces/face_to_del")
                        .header("Authorization", bearer("investigator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));

        assertTrue(store.facesForPerson("person_aariv").isEmpty());

        var audits = store.audit();
        boolean hasDeleteAudit = audits.stream()
                .anyMatch(a -> "vision:delete".equals(a.get("action")));
        assertTrue(hasDeleteAudit);
    }

    @Test
    void testSearchEmptyGalleryReturnsEmptyGalleryStatus() throws Exception {
        assertTrue(store.faces().isEmpty(), "Gallery should start empty");

        var engineSearchResp = json.createObjectNode()
                .put("status", "FACE_EXTRACTED")
                .put("faces_detected", 1)
                .put("model_name", "adaface_ir101_webface12m")
                .put("aligned_thumbnail", "data:image/jpeg;base64,thumb");
        engineSearchResp.set("embedding", createEmbedding(0.95, 0.05));
        when(engine.visionSearch(any(byte[].class), any(), anyDouble())).thenReturn(engineSearchResp);

        MockMultipartFile queryFile = new MockMultipartFile("file", "aariv_cctv.jpg", "image/jpeg", new byte[]{1, 2, 3});

        mvc.perform(multipart("/api/vision/search")
                        .file(queryFile)
                        .header("Authorization", bearer("investigator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EMPTY_GALLERY"))
                .andExpect(jsonPath("$.facesDetected").value(1))
                .andExpect(jsonPath("$.matches").isEmpty());

        var audits = store.audit();
        assertTrue(audits.stream().anyMatch(a -> "vision:search:empty_gallery".equals(a.get("action"))));
    }

    @Test
    void testDemoEnrollRbacAndViewerDenied() throws Exception {
        // 1. Viewer is rejected with 403 Forbidden
        mvc.perform(post("/api/vision/demo-enroll")
                        .header("Authorization", bearer("viewer")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

        // 2. Unauthenticated is rejected with 401
        mvc.perform(post("/api/vision/demo-enroll"))
            .andExpect(status().isUnauthorized());

        // 3. Mock engine enrollment for investigator
        var engineEnrollResp = json.createObjectNode()
                .put("image_hash", "mock_hash")
                .put("model_name", "adaface_ir101_webface12m")
                .put("model_version", "1.0.0")
                .put("thumbnail", "data:image/jpeg;base64,mock_thumb");
        engineEnrollResp.set("embedding", createEmbedding(1.0, 0.0));
        when(engine.visionEnroll(any(byte[].class))).thenReturn(engineEnrollResp);

        // 4. Investigator is authorized and successfully seeds gallery
        mvc.perform(post("/api/vision/demo-enroll")
                        .header("Authorization", bearer("investigator")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enrolledCount").isNumber())
            .andExpect(jsonPath("$.status").value("ok"));

        assertFalse(store.faces().isEmpty(), "Face gallery should have enrolled faces after seeding");
    }
}
