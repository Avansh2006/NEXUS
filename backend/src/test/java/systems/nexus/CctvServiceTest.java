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

import java.io.File;
import java.io.FileOutputStream;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static systems.nexus.Model.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:cctv_test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
public class CctvServiceTest extends TestCredentials {

    @Autowired
    private Store store;

    @Autowired
    private ObjectMapper json;

    @MockBean
    private EngineClient engine;

    @MockBean
    private EvidenceService evidenceService;

    private CctvService cctvService;
    private EvidenceAsset videoAsset;

    @BeforeEach
    void setUp() throws Exception {
        store.reset();
        cctvService = new CctvService(store, engine, evidenceService, json);

        // Create a temporary dummy video file
        File testDir = new File("target/test-cctv");
        testDir.mkdirs();
        File dummyVideo = new File(testDir, "test_cctv_junction.mp4");
        try (var fos = new FileOutputStream(dummyVideo)) {
            fos.write(new byte[]{0, 0, 0, 32, 102, 116, 121, 112, 109, 112, 52, 50});
        }

        videoAsset = new EvidenceAsset(
                "AST-VID-001",
                "CASE-019",
                "test_cctv_junction.mp4",
                "VIDEO",
                "video/mp4",
                dummyVideo.length(),
                "hash-vid-001",
                dummyVideo.getAbsolutePath(),
                "INGESTED",
                Instant.now().toString(),
                "investigator",
                json.createObjectNode()
        );
        store.saveEvidenceAsset(videoAsset);
    }

    @Test
    void testSearchCctvValidation() {
        // Empty query
        assertThrows(ResponseStatusException.class, () ->
                cctvService.searchCctv("AST-VID-001", "", 0.35, 0.25, "investigator"));

        // Non-existent asset
        assertThrows(ResponseStatusException.class, () ->
                cctvService.searchCctv("NON-EXISTENT", "white SUV", 0.35, 0.25, "investigator"));
    }

    @Test
    void testSearchCctvExecutionAndAudit() {
        // Mock engine response
        ObjectNode engineRes = json.createObjectNode();
        engineRes.put("analysisId", "CCTV-ANALYSIS-999");
        engineRes.put("query", "white SUV");
        engineRes.put("status", "READY");

        ObjectNode modelMeta = json.createObjectNode();
        modelMeta.put("dinoModel", "IDEA-Research/grounding-dino-tiny");
        modelMeta.put("samModel", "facebook/sam2.1-hiera-tiny");
        modelMeta.put("pipelineMode", "GROUNDING_DINO_SAM2");
        engineRes.set("modelMetadata", modelMeta);

        ArrayNode tracksArr = engineRes.putArray("tracks");
        ObjectNode trk1 = tracksArr.addObject();
        trk1.put("trackId", "TRACK-01");
        trk1.put("label", "white SUV");
        trk1.put("firstSeenMs", 14200L);
        trk1.put("lastSeenMs", 32800L);
        trk1.put("bestConfidence", 0.94);

        ObjectNode repFrame = trk1.putObject("representativeFrame");
        repFrame.put("frameIndex", 18);
        repFrame.put("timestampSec", 18.0);
        repFrame.put("thumbnail", "data:image/jpeg;base64,mockFullThumb");
        repFrame.put("cropThumbnail", "data:image/jpeg;base64,mockCropThumb");

        when(engine.cctvSearch(any(), anyString(), anyString(), anyString(), anyString(), any(), any()))
                .thenReturn(engineRes);

        CctvSearchResponse response = cctvService.searchCctv(
                "AST-VID-001",
                "white SUV",
                0.35,
                0.25,
                "investigator"
        );

        assertNotNull(response);
        assertEquals("CCTV-ANALYSIS-999", response.analysisId());
        assertEquals("READY", response.status());
        assertEquals(1, response.trackCount());
        assertEquals(1, response.tracks().size());

        CctvTrack track = response.tracks().get(0);
        assertEquals("TRACK-01", track.trackId());
        assertEquals("white SUV", track.label());
        assertEquals(14200L, track.firstSeenMs());
        assertEquals(32800L, track.lastSeenMs());
        assertEquals(0.94, track.bestConfidence());

        // Verify stored in DB
        Optional<CctvAnalysis> savedAnalysis = store.cctvAnalysis("CCTV-ANALYSIS-999");
        assertTrue(savedAnalysis.isPresent());
        assertEquals("white SUV", savedAnalysis.get().query());

        List<CctvTrack> dbTracks = store.cctvTracksByAnalysis("CCTV-ANALYSIS-999");
        assertEquals(1, dbTracks.size());

        // Verify audit log
        List<Map<String, Object>> auditLogs = store.audit();
        boolean startedAudited = auditLogs.stream().anyMatch(a -> "CCTV_SEARCH_STARTED".equals(a.get("action")));
        boolean completedAudited = auditLogs.stream().anyMatch(a -> "CCTV_SEARCH_COMPLETED".equals(a.get("action")));
        assertTrue(startedAudited, "CCTV_SEARCH_STARTED audit entry must exist");
        assertTrue(completedAudited, "CCTV_SEARCH_COMPLETED audit entry must exist");
    }

    @Test
    void testReviewCctvTrack() {
        // Seed analysis and track
        CctvAnalysis analysis = new CctvAnalysis(
                "CCTV-123",
                "AST-VID-001",
                "CASE-019",
                "person with red backpack",
                "READY",
                json.createObjectNode(),
                Instant.now().toString(),
                "investigator"
        );
        store.saveCctvAnalysis(analysis);

        CctvTrack track = new CctvTrack(
                "CTRK-CCTV-123-TRACK-01",
                "CCTV-123",
                "TRACK-01",
                "person with red backpack",
                5000L,
                15000L,
                0.89,
                json.createObjectNode(),
                json.createObjectNode()
        );
        store.saveCctvTrack(track);

        EvidenceReviewDecision decision = cctvService.reviewTrack(
                "CTRK-CCTV-123-TRACK-01",
                "CORROBORATED",
                "Confirmed suspect silhouette matching wiretap description",
                "investigator"
        );

        assertNotNull(decision);
        assertEquals("CORROBORATED", decision.decision());
        assertEquals("CTRK-CCTV-123-TRACK-01", decision.itemId());

        List<EvidenceReviewDecision> storedDecisions = store.evidenceReviews();
        assertTrue(storedDecisions.stream().anyMatch(d -> "CTRK-CCTV-123-TRACK-01".equals(d.itemId())));

        List<Map<String, Object>> auditLogs = store.audit();
        assertTrue(auditLogs.stream().anyMatch(a -> "CCTV_TRACK_REVIEWED".equals(a.get("action"))));
    }

    @Test
    void testSearchSimilarCropIntegration() {
        // Seed track with base64 crop thumbnail
        String sampleCropB64 = Base64.getEncoder().encodeToString(new byte[]{1, 2, 3, 4, 5});
        ObjectNode repFrame = json.createObjectNode();
        repFrame.put("cropThumbnail", "data:image/jpeg;base64," + sampleCropB64);

        CctvAnalysis analysis = new CctvAnalysis(
                "CCTV-123",
                "AST-VID-001",
                "CASE-019",
                "white SUV",
                "READY",
                json.createObjectNode(),
                Instant.now().toString(),
                "investigator"
        );
        store.saveCctvAnalysis(analysis);

        CctvTrack track = new CctvTrack(
                "CTRK-MOCK-CROP",
                "CCTV-123",
                "TRACK-01",
                "white SUV",
                1000L,
                5000L,
                0.92,
                repFrame,
                json.createObjectNode()
        );
        store.saveCctvTrack(track);

        VisualSearchResponse mockResponse = new VisualSearchResponse(
                List.of(new VisualMatchLead(
                        "AST-IMG-009",
                        "CASE-019",
                        0,
                        0.0,
                        0.92,
                        92.0,
                        "CASE-019 — Visual Similarity 92/100",
                        "Investigative lead only",
                        "data:image/jpeg;base64,thumb",
                        json.createObjectNode()
                )),
                1,
                0.60,
                "Visual lead notice"
        );

        when(evidenceService.visualSearch(any(byte[].class), isNull(), anyDouble(), anyInt(), anyString()))
                .thenReturn(mockResponse);

        VisualSearchResponse result = cctvService.searchSimilarCrop(
                "CTRK-MOCK-CROP",
                0.60,
                10,
                "investigator"
        );

        assertNotNull(result);
        assertEquals(1, result.count());
        assertEquals(92.0, result.matches().get(0).similarityScore());

        // Verify audit log
        List<Map<String, Object>> auditLogs = store.audit();
        assertTrue(auditLogs.stream().anyMatch(a -> "CCTV_CROP_VISUAL_SEARCH".equals(a.get("action"))));
    }

    @Test
    void testEngineFailureHandling() {
        when(engine.cctvSearch(any(), anyString(), anyString(), anyString(), anyString(), any(), any()))
                .thenThrow(new RuntimeException("Connection refused from neural sidecar"));

        assertThrows(ResponseStatusException.class, () ->
                cctvService.searchCctv("AST-VID-001", "white SUV", 0.35, 0.25, "investigator"));

        List<Map<String, Object>> auditLogs = store.audit();
        assertTrue(auditLogs.stream().anyMatch(a -> "CCTV_SEARCH_FAILED".equals(a.get("action"))));
    }
}
