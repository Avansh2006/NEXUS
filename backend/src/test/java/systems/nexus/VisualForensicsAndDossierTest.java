package systems.nexus;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static systems.nexus.Model.*;

class VisualForensicsAndDossierTest {
    private Store store;
    private IntelligenceSuiteService suiteService;
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
        suiteService = new IntelligenceSuiteService(store, engine, json);
    }

    private Graph sampleGraph() {
        Node n1 = new Node("SYN-PER-019", "Person", "Aariv Veylan", Map.of("caseIds", "NXS-001"));
        Node n2 = new Node("SYN-PER-021", "Person", "Mira Solven", Map.of("caseIds", "NXS-002"));
        Node n3 = new Node("SYN-PH-061", "Phone", "SYN-PHONE-061", Map.of("caseIds", "NXS-001"));

        Edge e1 = new Edge("EDGE-1", "USES", "SYN-PER-019", "SYN-PH-061", Map.of("support", Map.of("level", "High"), "events", List.of()));
        Edge e2 = new Edge("EDGE-2", "CALLED", "SYN-PH-061", "SYN-PER-021", Map.of("support", Map.of("level", "Medium"), "events", List.of()));

        Source s1 = new Source("SRC-001", "fir", json.createObjectNode().put("caseId", "NXS-001").put("sourceReliability", "Reliable"));
        Evidence ev1 = new Evidence("EV-001", "SRC-001", "SYN-PER-019", null, 0, 12, 1, "Aariv Veylan phone", 1.0);

        var alertsNode = json.createArrayNode();
        alertsNode.addObject().put("ruleId", "R1").put("explanation", "Shared device between distinct entities").put("suppressed", false).put("evidenceIds", "EV-001");

        var analysisNode = json.createObjectNode();
        analysisNode.set("alerts", alertsNode);

        return new Graph(List.of(n1, n2, n3), List.of(e1, e2), List.of(ev1), List.of(s1), analysisNode, true, List.of());
    }

    @Test
    void testAuditVerificationValidChain() {
        store.audit("investigation:open", "investigator", "SYN-PER-019", "digest1");
        store.audit("evidence:ingest", "investigator", "SRC-001", "digest2");
        store.audit("report:export", "investigator", "", "dossier");

        Map<String, Object> result = store.verifyAuditChain();
        assertTrue((Boolean) result.get("valid"), "Chain must be valid");
        assertEquals(3, result.get("entriesChecked"));
        assertEquals(3, result.get("entriesVerified"));
        assertNotNull(result.get("genesisHash"));
        assertNotNull(result.get("headHash"));
        assertNotNull(result.get("verifiedAt"));
        assertNull(result.get("firstBrokenEntry"));
    }

    @Test
    void testAuditVerificationCorruptedChain() {
        store.audit("investigation:open", "investigator", "SYN-PER-019", "digest1");
        store.audit("evidence:ingest", "investigator", "SRC-001", "digest2");
        store.audit("report:export", "investigator", "", "dossier");

        // Verify valid first
        assertTrue((Boolean) store.verifyAuditChain().get("valid"));

        // Tamper with second entry
        store.tamperAuditEntry(2, "UNAUTHORIZED_TAMPERED_ACTION");

        Map<String, Object> corrupted = store.verifyAuditChain();
        assertFalse((Boolean) corrupted.get("valid"), "Tampered chain must be invalid");
        assertNotNull(corrupted.get("brokenAtIndex"));
        assertEquals(1, corrupted.get("brokenAtIndex")); // 0-indexed second entry
        assertNotNull(corrupted.get("reason"));
        assertTrue(corrupted.get("reason").toString().contains("HASH_TAMPERING_DETECTED"));
    }

    @Test
    void testDossierAllSectionsAndSummary() {
        Graph g = sampleGraph();
        ReportRequest req = new ReportRequest("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
        String html = Report.renderDossier(g, req, store, suiteService, "analyst_1");

        assertNotNull(html);
        assertTrue(html.contains("NEXUS INVESTIGATION DOSSIER"));
        assertTrue(html.contains("SECTION 1 — Case &amp; Investigation Summary"));
        assertTrue(html.contains("SECTION 2 — Network Topology Overview"));
        assertTrue(html.contains("SECTION 3 — Source Evidence Index"));
        assertTrue(html.contains("SECTION 5 — Analytical Alert Signals (R1–R7)"));
        assertTrue(html.contains("SECTION 11 — Audit Chain Integrity Verification"));
        assertTrue(html.contains("SECTION 12 — Electronic Record Provenance Statement"));
        assertTrue(html.contains("SECTION 13 — Template Certificate (Bharatiya Sakshya Adhiniyam, 2023, Section 63)"));
        assertTrue(html.contains("SECTION 14 — Analytical Limitations &amp; Procedural Safeguards"));
        assertTrue(html.contains("Aariv Veylan"));
        assertTrue(html.contains("analyst_1"));
    }

    @Test
    void testReportHtmlEscaping() {
        Node malicious = new Node("EVIL-1", "Person", "<script>alert('xss')</script>&\"'", Map.of("caseIds", "CASE<1>"));
        Graph g = new Graph(List.of(malicious), List.of(), List.of(), List.of(), json.createObjectNode(), false, List.of());

        String html = Report.renderDossier(g, new ReportRequest(null), store, suiteService, "admin");
        assertFalse(html.contains("<script>alert('xss')</script>"), "Raw XSS script tags must be escaped");
        assertTrue(html.contains("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"));
        assertTrue(html.contains("&amp;&quot;&#39;"));
    }

    @Test
    void testCounterfactualSectionInclusion() {
        Graph g = sampleGraph();
        Node remNode = new Node("SYN-PH-061", "Phone", "SYN-PHONE-061", Map.of());
        Edge remEdge = new Edge("EDGE-1", "USES", "SYN-PER-019", "SYN-PH-061", Map.of());

        var alerts = json.createArrayNode();
        alerts.addObject().put("ruleId", "R1").put("explanation", "Shared device between distinct entities");

        WhatIfDelta delta = new WhatIfDelta(List.of(remNode), List.of(), List.of(remEdge), List.of(), List.of(alerts.get(0)), List.of());
        Graph simGraph = new Graph(List.of(g.nodes().get(0), g.nodes().get(1)), List.of(), List.of(), g.records(), json.createObjectNode(), true, List.of());
        WhatIfResponse whatIf = new WhatIfResponse(true, 1, "Exclusion of mobile device SYN-PHONE-061", delta, simGraph);

        ReportRequest req = new ReportRequest(null, List.of("summary", "whatIf"), "overlay", whatIf, null);
        String html = Report.renderDossier(g, req, store, suiteService, "investigator");

        assertTrue(html.contains("SECTION 7 — Counterfactual &amp; Sensitivity Analysis"));
        assertTrue(html.contains("CANONICAL GRAPH UNCHANGED"));
        assertTrue(html.contains("Exclusion of mobile device SYN-PHONE-061"));
        assertTrue(html.contains("SYN-PHONE-061"));
        assertTrue(html.contains("Alerts Impacted by Exclusion"));
    }

    @Test
    void testContradictionSectionInclusion() {
        store.saveContradictionReview(new ContradictionReview("SYN-C1-001", "C1", "RESOLVED", "Investigator reviewed cell tower records", "lead_inv", "2026-09-24T12:00:00Z"));

        Graph g = sampleGraph();
        ReportRequest req = new ReportRequest(null, List.of("summary", "contradictions"), "canonical", null, null);
        String html = Report.renderDossier(g, req, store, suiteService, "investigator");

        assertTrue(html.contains("SECTION 6 — Contradiction Engine Findings (C1–C6)"));
    }

    @Test
    void testVisualIdentitySectionInclusion() {
        store.addFaceDecision(new FaceDecision("DEC-001", "SYN-PER-019", "CONFIRMED", 0.884, "SCRFD+AdaFace", "hash123456", "Investigator visual confirmation", "admin", "2026-09-24T10:00:00Z"));

        Graph g = sampleGraph();
        ReportRequest req = new ReportRequest(null, List.of("summary", "vision"), "canonical", null, null);
        String html = Report.renderDossier(g, req, store, suiteService, "investigator");

        assertTrue(html.contains("SECTION 8 — Visual Identity Search Decisions"));
        assertTrue(html.contains("CONFIRMED"));
        assertTrue(html.contains("0.884"));
        assertTrue(html.contains("SYN-PER-019"));
        assertTrue(html.contains("Biometric embedding vectors are omitted from this dossier"));
    }

    @Test
    void testBsaTemplateClearlyMarkedAsTemplate() {
        Graph g = sampleGraph();
        ReportRequest req = new ReportRequest(null, List.of("bsa"), "canonical", null, null);
        String html = Report.renderDossier(g, req, store, suiteService, "investigator");

        assertTrue(html.contains("SECTION 13 — Template Certificate (Bharatiya Sakshya Adhiniyam, 2023, Section 63)"));
        assertTrue(html.contains("NOTICE: TEMPLATE ONLY"));
        assertTrue(html.contains("Software cannot self-certify its own legal validity"));
        assertTrue(html.contains("PART A — Certificate by Person in Lawful Management"));
        assertTrue(html.contains("PART B — Certificate by Technical / Forensic Expert"));
    }
}
