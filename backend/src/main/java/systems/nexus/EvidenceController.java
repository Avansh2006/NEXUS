package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.*;

import static systems.nexus.Model.*;

@RestController
@RequestMapping("/api/evidence")
public class EvidenceController {
    private final EvidenceService evidenceService;
    private final EngineClient engine;

    public EvidenceController(EvidenceService evidenceService, EngineClient engine) {
        this.evidenceService = evidenceService;
        this.engine = engine;
    }

    private String currentUser(HttpServletRequest req) {
        String u = (String) req.getAttribute("nexus.user");
        return u != null ? u : "anonymous";
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("status", "ok");
        try {
            res.put("engine", engine.evidenceStatus());
        } catch (Exception e) {
            res.put("engine", Map.of("status", "offline", "error", e.getMessage()));
        }
        res.put("totalAssets", evidenceService.listAssets(null, null).size());
        return res;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public EvidenceAsset upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "caseId", required = false) String caseId,
            @RequestParam(value = "mediaType", required = false) String mediaType,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "autoAnalyze", defaultValue = "true") boolean autoAnalyze,
            HttpServletRequest req
    ) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required");
        }
        return evidenceService.uploadEvidence(
                file.getBytes(),
                file.getOriginalFilename(),
                caseId,
                mediaType,
                description,
                currentUser(req),
                autoAnalyze
        );
    }

    @GetMapping("/assets")
    public List<EvidenceAsset> listAssets(
            @RequestParam(value = "caseId", required = false) String caseId,
            @RequestParam(value = "mediaType", required = false) String mediaType
    ) {
        return evidenceService.listAssets(caseId, mediaType);
    }

    @GetMapping("/assets/{assetId}")
    public Map<String, Object> getAsset(@PathVariable String assetId) {
        return evidenceService.getAssetDetail(assetId);
    }

    @PostMapping("/document/analyze")
    public Map<String, Object> analyzeDocument(
            @RequestBody Map<String, String> request,
            HttpServletRequest req
    ) {
        String assetId = request.get("assetId");
        if (assetId == null || assetId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assetId is required");
        }
        return evidenceService.analyzeDocument(assetId, currentUser(req));
    }

    @PostMapping("/audio/analyze")
    public Map<String, Object> analyzeAudio(
            @RequestBody Map<String, String> request,
            HttpServletRequest req
    ) {
        String assetId = request.get("assetId");
        if (assetId == null || assetId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assetId is required");
        }
        return evidenceService.analyzeAudio(assetId, currentUser(req));
    }

    @PostMapping(value = "/visual-search", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public VisualSearchResponse searchVisualMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "assetId", required = false) String assetId,
            @RequestParam(value = "threshold", required = false) Double threshold,
            @RequestParam(value = "topK", required = false) Integer topK,
            HttpServletRequest req
    ) throws IOException {
        byte[] bytes = (file != null && !file.isEmpty()) ? file.getBytes() : null;
        return evidenceService.visualSearch(bytes, assetId, threshold, topK, currentUser(req));
    }

    @PostMapping(value = "/visual-search", consumes = MediaType.APPLICATION_JSON_VALUE)
    public VisualSearchResponse searchVisualJson(
            @RequestBody Map<String, Object> request,
            HttpServletRequest req
    ) {
        String assetId = (String) request.get("assetId");
        Double threshold = request.get("threshold") != null ? ((Number) request.get("threshold")).doubleValue() : null;
        Integer topK = request.get("topK") != null ? ((Number) request.get("topK")).intValue() : null;
        return evidenceService.visualSearch(null, assetId, threshold, topK, currentUser(req));
    }

    @PostMapping("/items/{itemId}/decision")
    public EvidenceReviewDecision recordDecision(
            @PathVariable String itemId,
            @RequestBody EvidenceReviewRequest request,
            HttpServletRequest req
    ) {
        return evidenceService.recordReviewDecision(itemId, request.decision(), request.notes(), currentUser(req));
    }

    @GetMapping("/reviews")
    public List<EvidenceReviewDecision> listReviews(
            @RequestParam(value = "caseId", required = false) String caseId
    ) {
        return evidenceService.listReviews(caseId);
    }

    @PostMapping("/seed-demo")
    public Map<String, Object> seedDemo(HttpServletRequest req) {
        return evidenceService.seedDemoMultimodalEvidence(currentUser(req));
    }
}
