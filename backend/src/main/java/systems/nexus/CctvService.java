package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;

import static systems.nexus.Model.*;

@Service
@Transactional
public class CctvService {

    private final Store store;
    private final EngineClient engine;
    private final EvidenceService evidenceService;
    private final ObjectMapper json;

    @Autowired
    public CctvService(
            Store store,
            EngineClient engine,
            EvidenceService evidenceService,
            ObjectMapper json
    ) {
        this.store = store;
        this.engine = engine;
        this.evidenceService = evidenceService;
        this.json = json;
    }

    public JsonNode getCctvStatus() {
        try {
            return engine.cctvStatus();
        } catch (Exception e) {
            var node = json.createObjectNode();
            node.put("status", "offline");
            node.put("pipelineMode", "OFFLINE_FALLBACK");
            node.put("error", e.getMessage());
            return node;
        }
    }

    public CctvSearchResponse searchCctv(
            String assetId,
            String query,
            Double boxThreshold,
            Double textThreshold,
            String user
    ) {
        if (query == null || query.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CCTV query cannot be empty");
        }
        if (query.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CCTV query exceeds 200 characters");
        }

        EvidenceAsset asset = store.evidenceAsset(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence asset not found: " + assetId));

        if (!"VIDEO".equalsIgnoreCase(asset.mediaType()) && !asset.fileName().toLowerCase().matches(".*\\.(mp4|avi|mov|mkv|webm)$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Asset must be a video evidence file: " + asset.fileName());
        }

        byte[] videoBytes;
        try {
            var path = Paths.get(asset.storagePath());
            if (!Files.exists(path)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence video file not found on disk");
            }
            videoBytes = Files.readAllBytes(path);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read evidence video: " + e.getMessage());
        }

        store.audit("CCTV_SEARCH_STARTED", user, assetId, Store.sha256("Query: " + query));

        JsonNode engineRes;
        try {
            engineRes = engine.cctvSearch(
                    videoBytes,
                    asset.fileName(),
                    query.trim(),
                    asset.id(),
                    asset.caseId(),
                    boxThreshold,
                    textThreshold
            );
        } catch (Exception e) {
            store.audit("CCTV_SEARCH_FAILED", user, assetId, Store.sha256("Error: " + e.getMessage()));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "CCTV intelligence engine inference failed: " + e.getMessage());
        }

        String analysisId = engineRes.path("analysisId").asText("CCTV-" + System.currentTimeMillis());
        JsonNode modelMeta = engineRes.path("modelMetadata");
        String leadNotice = engineRes.path("leadNotice").asText(
                "MACHINE-GENERATED INVESTIGATIVE LEADS: CCTV detections indicate algorithmic candidate tracks only. They do not establish physical identity or prove ownership."
        );

        CctvAnalysis analysis = new CctvAnalysis(
                analysisId,
                asset.id(),
                asset.caseId(),
                query.trim(),
                "READY",
                modelMeta,
                Instant.now().toString(),
                user
        );
        store.saveCctvAnalysis(analysis);

        List<CctvTrack> trackList = new ArrayList<>();
        JsonNode tracksNode = engineRes.path("tracks");
        if (tracksNode.isArray()) {
            for (JsonNode t : tracksNode) {
                String trkId = t.path("trackId").asText("TRACK-01");
                String label = t.path("label").asText(query);
                long firstSeen = t.path("firstSeenMs").asLong(0);
                long lastSeen = t.path("lastSeenMs").asLong(0);
                double bestConf = t.path("bestConfidence").asDouble(0.8);
                JsonNode repFrame = t.path("representativeFrame");

                CctvTrack cctvTrack = new CctvTrack(
                        "CTRK-" + analysisId + "-" + trkId,
                        analysisId,
                        trkId,
                        label,
                        firstSeen,
                        lastSeen,
                        bestConf,
                        repFrame,
                        t
                );
                store.saveCctvTrack(cctvTrack);
                trackList.add(cctvTrack);
            }
        }

        store.audit("CCTV_SEARCH_COMPLETED", user, assetId, Store.sha256("Found " + trackList.size() + " candidate tracks for query: " + query));

        return new CctvSearchResponse(
                analysisId,
                asset.id(),
                asset.caseId(),
                query.trim(),
                "READY",
                trackList.size(),
                trackList,
                modelMeta,
                leadNotice
        );
    }

    public List<CctvAnalysis> listAnalyses(String assetId) {
        if (assetId != null && !assetId.isBlank()) {
            return store.cctvAnalysesByAsset(assetId);
        }
        return store.cctvAnalyses();
    }

    public Optional<CctvAnalysis> getAnalysis(String analysisId) {
        return store.cctvAnalysis(analysisId);
    }

    public List<CctvTrack> getTracksForAnalysis(String analysisId) {
        return store.cctvTracksByAnalysis(analysisId);
    }

    public Optional<CctvTrack> getTrack(String trackId) {
        return store.cctvTrack(trackId);
    }

    public EvidenceReviewDecision reviewTrack(String trackId, String decision, String notes, String user) {
        CctvTrack track = store.cctvTrack(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CCTV track not found: " + trackId));

        CctvAnalysis analysis = store.cctvAnalysis(track.analysisId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Associated CCTV analysis not found"));

        if (!"ACCEPTED".equals(decision) && !"REJECTED".equals(decision) && !"CORROBORATED".equals(decision)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid determination: must be ACCEPTED, REJECTED, or CORROBORATED");
        }

        EvidenceReviewDecision rev = new EvidenceReviewDecision(
                "REV-" + track.id(),
                track.id(),
                analysis.caseId(),
                decision,
                notes != null ? notes : "",
                user,
                Instant.now().toString()
        );
        store.saveEvidenceReview(rev);
        store.audit("CCTV_TRACK_REVIEWED", user, track.id(), Store.sha256(decision + ":" + (notes != null ? notes : "")));
        return rev;
    }

    public VisualSearchResponse searchSimilarCrop(
            String trackId,
            Double threshold,
            Integer topK,
            String user
    ) {
        CctvTrack track = store.cctvTrack(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CCTV track not found: " + trackId));

        JsonNode repFrame = track.representativeFrame();
        String cropThumbnail = repFrame.path("cropThumbnail").asText();
        if (cropThumbnail.isEmpty()) {
            cropThumbnail = repFrame.path("thumbnail").asText();
        }
        if (cropThumbnail.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Track has no representative image crop available for visual search");
        }

        byte[] cropBytes;
        try {
            String b64 = cropThumbnail;
            if (b64.contains(",")) {
                b64 = b64.substring(b64.indexOf(",") + 1);
            }
            cropBytes = Base64.getDecoder().decode(b64);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid crop thumbnail base64 data");
        }

        store.audit("CCTV_CROP_VISUAL_SEARCH", user, track.id(), Store.sha256("Crop search: " + track.label()));
        return evidenceService.visualSearch(cropBytes, null, threshold, topK, user);
    }
}
