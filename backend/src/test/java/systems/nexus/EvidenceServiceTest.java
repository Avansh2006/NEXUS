package systems.nexus;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static systems.nexus.Model.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:evidence_test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
public class EvidenceServiceTest extends TestCredentials {

    @Autowired
    private Store store;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private InvestigationService investigationService;

    @MockBean
    private EngineClient engine;

    private EvidenceService service;

    @BeforeEach
    void setUp() {
        store.reset();
        service = new EvidenceService(store, engine, json, investigationService, "target/test-evidence");
    }

    @Test
    void testUploadValidation() {
        // Empty file should throw 400
        assertThrows(ResponseStatusException.class, () ->
                service.uploadEvidence(new byte[0], "empty.txt", "NXS-007", "DOCUMENT", "test", "investigator", false)
        );

        // Valid file upload
        byte[] content = "Sample FIR text content".getBytes();
        EvidenceAsset asset = service.uploadEvidence(content, "fir_sample.txt", "NXS-007", "DOCUMENT", "Test FIR", "investigator", false);

        assertNotNull(asset);
        assertTrue(asset.id().startsWith("AST-"));
        assertEquals("NXS-007", asset.caseId());
        assertEquals("DOCUMENT", asset.mediaType());
        assertEquals("fir_sample.txt", asset.fileName());
        assertEquals("UPLOADED", asset.status());
        assertNotNull(asset.fileHash());

        // Verify asset exists in store
        Optional<EvidenceAsset> retrieved = store.evidenceAsset(asset.id());
        assertTrue(retrieved.isPresent());
        assertEquals(asset.fileHash(), retrieved.get().fileHash());

        // Verify audit log entry
        var auditStatus = store.verifyAuditChain();
        assertTrue((Boolean) auditStatus.get("valid"));
    }

    @Test
    void testDocumentOcrAndEntityExtraction() {
        // Mock engine OCR response
        ObjectNode mockOcr = json.createObjectNode();
        mockOcr.put("model", "PaddleOCR-PP-OCRv5");
        mockOcr.put("pageCount", 1);
        mockOcr.put("combinedText", "Accused Aariv Veylan transferred INR 75,000 to SYN-ACCOUNT-001");

        ArrayNode entities = mockOcr.putArray("entities");
        ObjectNode ent1 = entities.addObject();
        ent1.put("type", "Person");
        ent1.put("raw", "Aariv Veylan");
        ent1.put("confidence", 0.95);
        ent1.put("pageNumber", 1);

        ObjectNode ent2 = entities.addObject();
        ent2.put("type", "Account");
        ent2.put("raw", "SYN-ACCOUNT-001");
        ent2.put("confidence", 0.98);
        ent2.put("pageNumber", 1);

        when(engine.evidenceDocumentOcr(any(), anyString(), anyString())).thenReturn(mockOcr);

        byte[] content = "Scanned document bytes".getBytes();
        EvidenceAsset asset = service.uploadEvidence(content, "scanned_fir.pdf", "NXS-007", "DOCUMENT", "Scanned FIR", "investigator", false);

        Map<String, Object> analysis = service.analyzeDocument(asset.id(), "investigator");
        assertNotNull(analysis);
        assertEquals("ANALYZED", analysis.get("status"));

        // Verify extracted evidence items saved
        List<EvidenceItem> items = store.evidenceItemsByAsset(asset.id());
        assertFalse(items.isEmpty());
        assertTrue(items.stream().anyMatch(i -> i.itemType().equals("DOCUMENT_TEXT")));
        assertTrue(items.stream().anyMatch(i -> i.itemType().equals("EXTRACTED_ENTITY") && i.rawContent().contains("Aariv Veylan")));

        // Verify updated asset status
        EvidenceAsset updated = store.evidenceAsset(asset.id()).orElseThrow();
        assertEquals("ANALYZED", updated.status());
    }

    @Test
    void testAudioTranscriptionAndDiarization() {
        ObjectNode mockAudio = json.createObjectNode();
        mockAudio.put("model", "faster-whisper-small-int8");
        mockAudio.put("language", "hi");
        mockAudio.put("durationSeconds", 18.5);
        mockAudio.put("fullTranscript", "Transfer funds to SYN-ACCOUNT-001 now");

        ArrayNode segments = mockAudio.putArray("segments");
        ObjectNode seg1 = segments.addObject();
        seg1.put("start", 0.0);
        seg1.put("end", 5.0);
        seg1.put("speaker", "SPEAKER_00");
        seg1.put("text", "Transfer funds to SYN-ACCOUNT-001 now");

        ArrayNode entities = mockAudio.putArray("entities");
        ObjectNode ent1 = entities.addObject();
        ent1.put("type", "Account");
        ent1.put("raw", "SYN-ACCOUNT-001");
        ent1.put("timestampStart", 0.0);
        ent1.put("timestampEnd", 5.0);
        ent1.put("speaker", "SPEAKER_00");

        when(engine.evidenceAudioTranscribe(any(), anyString(), anyString())).thenReturn(mockAudio);

        byte[] audioBytes = "RIFF....WAVE".getBytes();
        EvidenceAsset asset = service.uploadEvidence(audioBytes, "call.wav", "NXS-007", "AUDIO", "Wiretap", "investigator", false);

        Map<String, Object> analysis = service.analyzeAudio(asset.id(), "investigator");
        assertNotNull(analysis);
        assertEquals("ANALYZED", analysis.get("status"));

        List<EvidenceItem> items = store.evidenceItemsByAsset(asset.id());
        assertTrue(items.stream().anyMatch(i -> i.itemType().equals("AUDIO_SEGMENT")));
        assertTrue(items.stream().anyMatch(i -> i.itemType().equals("EXTRACTED_ENTITY") && i.speaker().equals("SPEAKER_00")));
    }

    @Test
    void testVisualSearchRankingAndDisclaimer() {
        // Seed visual gallery item in CASE-019
        EvidenceAsset targetAsset = service.uploadEvidence(new byte[]{1, 2, 3}, "vehicle_019.jpg", "CASE-019", "IMAGE", "Target", "investigator", false);

        ArrayNode targetEmb = json.createArrayNode();
        for (int i = 0; i < 512; i++) targetEmb.add(i == 0 ? 1.0 : 0.0); // Unit vector along axis 0

        EvidenceItem targetItem = new EvidenceItem(
                "ITM-VIS-01", targetAsset.id(), "VISUAL_EMBEDDING", 0, 0.0, 0.0, "",
                "Vehicle Image Frame", 1.0, targetEmb, "OpenCLIP-ViT-B-32-laion2b_s34b_b79k",
                json.createObjectNode().put("thumbnail", "data:image/jpeg;base64,thumb"),
                "2026-09-24T12:00:00Z"
        );
        store.saveEvidenceItem(targetItem);

        // Upload probe in NXS-007 with very close vector
        EvidenceAsset probeAsset = service.uploadEvidence(new byte[]{1, 2, 4}, "probe_cctv.jpg", "NXS-007", "IMAGE", "Probe", "investigator", false);

        ArrayNode probeEmb = json.createArrayNode();
        for (int i = 0; i < 512; i++) probeEmb.add(i == 0 ? 0.95 : (i == 1 ? 0.05 : 0.0));

        EvidenceItem probeItem = new EvidenceItem(
                "ITM-VIS-02", probeAsset.id(), "VISUAL_EMBEDDING", 0, 0.0, 0.0, "",
                "Probe Frame", 1.0, probeEmb, "OpenCLIP-ViT-B-32-laion2b_s34b_b79k",
                json.createObjectNode().put("thumbnail", "data:image/jpeg;base64,thumb2"),
                "2026-09-24T12:01:00Z"
        );
        store.saveEvidenceItem(probeItem);

        // Mock engine visual search response (or test in-memory fallback)
        when(engine.evidenceVisualSearch(anyList(), anyList(), anyDouble(), anyInt())).thenThrow(new RuntimeException("Engine offline for test"));

        VisualSearchResponse resp = service.visualSearch(null, probeAsset.id(), 0.50, 5, "investigator");
        assertNotNull(resp);
        assertFalse(resp.matches().isEmpty());

        VisualMatchLead lead = resp.matches().get(0);
        assertEquals(targetAsset.id(), lead.matchAssetId());
        assertEquals("CASE-019", lead.matchCaseId());
        assertTrue(lead.similarityScore() >= 90.0);
        assertTrue(lead.similarityDisplay().contains("CASE-019 — Visual Similarity"));
        assertTrue(lead.leadDisclaimer().contains("Visual similarity lead only"));
    }

    @Test
    void testReviewDecisionAndAuditLogging() {
        EvidenceReviewDecision decision = service.recordReviewDecision(
                "ITM-ENT-001",
                "ACCEPTED",
                "Investigator corroborated phone number with telecom CDR records",
                "investigator"
        );

        assertNotNull(decision);
        assertEquals("ACCEPTED", decision.decision());
        assertEquals("ITM-ENT-001", decision.itemId());

        List<EvidenceReviewDecision> reviews = service.listReviews("NXS-007");
        assertEquals(1, reviews.size());
        assertEquals("ACCEPTED", reviews.get(0).decision());

        // Verify audit chain remains cryptographically valid
        var auditVerify = store.verifyAuditChain();
        assertTrue((Boolean) auditVerify.get("valid"));
    }

    @Test
    void testSeedDemoMultimodalEvidence() {
        ObjectNode mockOcr = json.createObjectNode();
        mockOcr.put("model", "PaddleOCR-PP-OCRv5");
        mockOcr.put("pageCount", 1);
        mockOcr.put("combinedText", "FIR Text");
        mockOcr.putArray("entities");
        when(engine.evidenceDocumentOcr(any(), anyString(), anyString())).thenReturn(mockOcr);

        ObjectNode mockAudio = json.createObjectNode();
        mockAudio.put("model", "faster-whisper-small-int8");
        mockAudio.put("language", "hi");
        mockAudio.put("fullTranscript", "Transcript");
        mockAudio.putArray("segments");
        mockAudio.putArray("entities");
        when(engine.evidenceAudioTranscribe(any(), anyString(), anyString())).thenReturn(mockAudio);

        ObjectNode mockVisual = json.createObjectNode();
        mockVisual.put("model", "OpenCLIP-ViT-B-32-laion2b_s34b_b79k");
        mockVisual.putArray("frames");
        when(engine.evidenceVisualEmbed(any(), anyString(), anyString(), anyString(), anyString())).thenReturn(mockVisual);

        Map<String, Object> result = service.seedDemoMultimodalEvidence("investigator");
        assertTrue((Boolean) result.get("seeded"));
        assertNotNull(result.get("documentAssetId"));
        assertNotNull(result.get("audioAssetId"));
        assertNotNull(result.get("visualTargetAssetId"));
        assertNotNull(result.get("visualProbeAssetId"));

        List<EvidenceAsset> assets = service.listAssets(null, null);
        assertTrue(assets.size() >= 4);
    }

    @Test
    void testPromoteEntityToCanonicalGraph() {
        EvidenceAsset asset = service.uploadEvidence("Evidence narrative".getBytes(), "fir_scan.pdf", "NXS-007", "DOCUMENT", "Scanned FIR", "investigator", false);

        ObjectNode prov = json.createObjectNode();
        prov.put("entityType", "Person");
        prov.put("citation", "Suspect Aariv Veylan was spotted fleeing");

        EvidenceItem item = new EvidenceItem(
                "ITM-ENT-999",
                asset.id(),
                "EXTRACTED_ENTITY",
                1,
                0.0,
                0.0,
                "",
                "Aariv Veylan",
                0.95,
                json.createArrayNode(),
                "PP-OCRv5",
                prov,
                java.time.Instant.now().toString()
        );
        store.saveEvidenceItem(item);

        when(engine.extract(anyString(), anyString())).thenReturn(new Extraction(
                List.of(new Extracted("Person", "Aariv Veylan", 0, 12, 0.95, "Aariv Veylan", "Suspect", "src-1"))
        ));

        Map<String, Object> res = service.promoteEntityToGraph("ITM-ENT-999", "Corroborated by field unit", "investigator");
        assertNotNull(res);
        assertTrue((Boolean) res.get("promoted"));
        assertEquals("Aariv Veylan", res.get("entityLabel"));

        // Verify entity was added to store records/graph
        Graph g = (Graph) res.get("graph");
        assertNotNull(g);
        assertTrue(g.records().stream().anyMatch(r -> r.payload().path("text").asText().contains("Aariv Veylan")));
    }
}
