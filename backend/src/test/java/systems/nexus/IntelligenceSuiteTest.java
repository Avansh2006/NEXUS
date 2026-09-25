package systems.nexus;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static systems.nexus.Model.*;

class IntelligenceSuiteTest {
    private Store store;
    private IntelligenceSuiteService service;
    private EngineClient engine;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach
    void setup() {
        var ds = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);
        var db = new JdbcTemplate(ds);
        store = new Store(db, json);
        engine = Mockito.mock(EngineClient.class);
        Mockito.when(engine.analyze(Mockito.any())).thenReturn(json.createObjectNode());
        service = new IntelligenceSuiteService(store, engine, json);
    }

    private void seedSampleNetwork() throws Exception {
        // Seed two sources: Case NXS-001 (FIR) and Case NXS-002 (FIR)
        String fir1 = """
            {
                "caseId": "NXS-001",
                "date": "2026-09-02T09:00:00Z",
                "crimeType": "Investment scam",
                "text": "Accused Aariv Veylan phone SYN-PHONE-001 account SYN-ACCOUNT-001",
                "_entities": [
                    {"type": "Person", "raw": "Aariv Veylan", "normalized": "Aariv Veylan", "role": "Accused"},
                    {"type": "Phone", "raw": "SYN-PHONE-001", "normalized": "SYN-PHONE-001", "role": ""},
                    {"type": "Account", "raw": "SYN-ACCOUNT-001", "normalized": "SYN-ACCOUNT-001", "role": ""}
                ]
            }
            """;
        String fir2 = """
            {
                "caseId": "NXS-002",
                "date": "2026-09-03T09:00:00Z",
                "crimeType": "Fake-job fraud",
                "text": "Accused Mira Solven phone SYN-PHONE-001 account SYN-ACCOUNT-001 Co-accused Aariv Veylan",
                "_entities": [
                    {"type": "Person", "raw": "Mira Solven", "normalized": "Mira Solven", "role": "Accused"},
                    {"type": "Person", "raw": "Aariv Veylan", "normalized": "Aariv Veylan", "role": "Witness"},
                    {"type": "Phone", "raw": "SYN-PHONE-001", "normalized": "SYN-PHONE-001", "role": ""}
                ]
            }
            """;
        store.source("src-001", "fir", "hash1", json.readTree(fir1));
        store.source("src-002", "fir", "hash2", json.readTree(fir2));

        Node p1 = new Node("person-aariv", "Person", "Aariv Veylan", Map.of("evidenceIds", List.of("ev-1"), "caseIds", List.of("NXS-001", "NXS-002")));
        Node p2 = new Node("person-mira", "Person", "Mira Solven", Map.of("evidenceIds", List.of("ev-2"), "caseIds", List.of("NXS-002")));
        Node ph1 = new Node("phone-001", "Phone", "SYN-PHONE-001", Map.of("evidenceIds", List.of("ev-1", "ev-2"), "caseIds", List.of("NXS-001", "NXS-002")));
        Node acc1 = new Node("account-001", "Account", "SYN-ACCOUNT-001", Map.of("evidenceIds", List.of("ev-1"), "caseIds", List.of("NXS-001")));
        Node p3 = new Node("person-aariv-dup", "Person", "Aariv Veylen", Map.of("evidenceIds", List.of("ev-3"), "caseIds", List.of("NXS-006")));
        Node v1 = new Node("vehicle-001", "Vehicle", "ZZ00NX0001", Map.of("evidenceIds", List.of("ev-4"), "caseIds", List.of("NXS-005")));

        Edge e1 = new Edge("edge-1", "person-aariv", "phone-001", "USES", Map.of("evidenceIds", List.of("ev-1")));
        Edge e2 = new Edge("edge-2", "person-mira", "phone-001", "USES", Map.of("evidenceIds", List.of("ev-2")));
        Edge e3 = new Edge("edge-3", "person-aariv", "person-mira", "CO_ACCUSED", Map.of("evidenceIds", List.of("ev-2")));

        Evidence ev1 = new Evidence("ev-1", "src-001", "person-aariv", "edge-1", 0, 10, 1, "Aariv Veylan", 0.95);
        Evidence ev2 = new Evidence("ev-2", "src-002", "person-mira", "edge-2", 0, 10, 1, "Mira Solven", 0.95);

        Graph g = new Graph(
                List.of(p1, p2, ph1, acc1, p3, v1),
                List.of(e1, e2, e3),
                List.of(ev1, ev2),
                List.of(),
                json.readTree("{\"alerts\": [{\"id\": \"alt-r1\", \"ruleId\": \"R1\", \"entityIds\": [\"person-aariv\", \"person-mira\"]}]}"),
                true,
                List.of()
        );
        store.persist(g);
    }

    @Test
    void testReplay() throws Exception {
        seedSampleNetwork();
        ReplayResponse resp = service.replay(null);
        assertNotNull(resp);
        assertEquals(2, resp.totalSteps());
        assertEquals(2, resp.steps().size());
        assertEquals(1, resp.steps().get(0).step());
        assertEquals("src-001", resp.steps().get(0).recordId());
        assertEquals("NXS-001", resp.steps().get(0).caseId());
        assertNotNull(resp.graphAtStep());

        // Test specific step
        ReplayResponse step1 = service.replay(1);
        assertEquals(2, step1.totalSteps());
        assertNotNull(step1.graphAtStep());
    }

    @Test
    void testCounterfactualDoesNotModifyDatabase() throws Exception {
        seedSampleNetwork();
        Graph before = store.graph();
        assertEquals(6, before.nodes().size());

        // Simulate excluding src-002
        WhatIfRequest req = new WhatIfRequest(List.of("src-002"), List.of(), List.of(), List.of());
        WhatIfResponse resp = service.whatIf(req);

        assertTrue(resp.canonicalGraphUnchanged());
        assertEquals(1, resp.excludedCount());
        assertNotNull(resp.summary());
        assertNotNull(resp.delta());

        // Verify canonical database state is 100% UNCHANGED
        Graph after = store.graph();
        assertEquals(6, after.nodes().size());
        assertEquals(3, after.edges().size());
        assertEquals(before.nodes().size(), after.nodes().size());
    }

    @Test
    void testContradictionEngineDetectionAndReview() throws Exception {
        seedSampleNetwork();
        List<Contradiction> contradictions = service.contradictions();
        assertFalse(contradictions.isEmpty());

        // C1 should detect SYN-PHONE-001 used by Aariv Veylan & Mira Solven
        assertTrue(contradictions.stream().anyMatch(c -> "C1".equals(c.ruleId())));
        // C4 should detect near duplicate Aariv Veylan vs Aariv Veylen
        assertTrue(contradictions.stream().anyMatch(c -> "C4".equals(c.ruleId())));
        // C5 should detect incompatible role attribution (Accused vs Witness for Aariv)
        assertTrue(contradictions.stream().anyMatch(c -> "C5".equals(c.ruleId())));

        // Test review workflow
        Contradiction c1 = contradictions.stream().filter(c -> "C1".equals(c.ruleId())).findFirst().orElseThrow();
        ContradictionReview rev = service.reviewContradiction(c1.id(), new ContradictionReviewRequest("ACKNOWLEDGED", "Investigator validated shared phone"), "investigator1");
        assertEquals("ACKNOWLEDGED", rev.status());
        assertEquals("investigator1", rev.author());

        // Next fetch should show reviewed status
        List<Contradiction> updated = service.contradictions();
        Contradiction reviewedC1 = updated.stream().filter(c -> c.id().equals(c1.id())).findFirst().orElseThrow();
        assertEquals("ACKNOWLEDGED", reviewedC1.reviewStatus());
        assertEquals("Investigator validated shared phone", reviewedC1.reviewNotes());
    }

    @Test
    void testEvidenceTrailMode() throws Exception {
        seedSampleNetwork();
        EvidenceTrailResponse trail = service.evidenceTrail("person-aariv", "person-mira");
        assertNotNull(trail);
        assertEquals("person-aariv", trail.fromNodeId());
        assertEquals("person-mira", trail.toNodeId());
        assertFalse(trail.paths().isEmpty());
        assertTrue(trail.chainSummary().contains("Aariv Veylan"));

        // Non-existent target should throw 404
        assertThrows(ResponseStatusException.class, () -> service.evidenceTrail("person-aariv", "missing-node"));
    }

    @Test
    void testInvestigationGapsFinder() throws Exception {
        seedSampleNetwork();
        GapsResponse gaps = service.gaps();
        assertNotNull(gaps);
        assertTrue(gaps.totalGaps() > 0);
        assertTrue(gaps.gapsByCategory().containsKey("DEAD_END_LEAD") || gaps.gapsByCategory().containsKey("UNVERIFIED_ASSET"));
    }

    @Test
    void testNetworkChangeRadar() throws Exception {
        seedSampleNetwork();
        NetworkChangesResponse changes = service.changes();
        assertNotNull(changes);
        assertTrue(changes.totalChanges() >= 5);
        assertTrue(changes.changesByType().containsKey("BRIDGE_FORMED"));
    }

    @Test
    void testStoreResetClearsContradictionReviews() throws Exception {
        seedSampleNetwork();
        service.reviewContradiction("C1-SYN-PHONE-001", new ContradictionReviewRequest("RESOLVED", "Cleared"), "admin");
        assertFalse(store.contradictionReviews().isEmpty());

        store.reset();
        assertTrue(store.contradictionReviews().isEmpty());
    }
}
