package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

import static systems.nexus.Model.*;

@RestController
@RequestMapping("/api/cctv")
public class CctvController {

    private final CctvService cctvService;

    public CctvController(CctvService cctvService) {
        this.cctvService = cctvService;
    }

    private String currentUser(HttpServletRequest req) {
        String u = (String) req.getAttribute("nexus.user");
        return u != null ? u : "anonymous";
    }

    private void checkCanEdit(HttpServletRequest req) {
        String role = (String) req.getAttribute("nexus.role");
        if ("VIEWER".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Viewers are not permitted to execute CCTV analysis or record determinations");
        }
    }

    @GetMapping("/status")
    public JsonNode status() {
        return cctvService.getCctvStatus();
    }

    @PostMapping("/search")
    public CctvSearchResponse search(
            @RequestBody CctvSearchRequest reqBody,
            HttpServletRequest req
    ) {
        checkCanEdit(req);
        if (reqBody.assetId() == null || reqBody.assetId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Asset ID is required for CCTV hunt");
        }
        if (reqBody.query() == null || reqBody.query().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Natural language query is required");
        }
        return cctvService.searchCctv(
                reqBody.assetId(),
                reqBody.query(),
                reqBody.boxThreshold(),
                reqBody.textThreshold(),
                currentUser(req)
        );
    }

    @GetMapping("/analyses")
    public List<CctvAnalysis> listAnalyses(
            @RequestParam(value = "assetId", required = false) String assetId
    ) {
        return cctvService.listAnalyses(assetId);
    }

    @GetMapping("/analyses/{id}")
    public CctvAnalysis getAnalysis(@PathVariable("id") String id) {
        return cctvService.getAnalysis(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CCTV analysis not found: " + id));
    }

    @GetMapping("/analyses/{id}/tracks")
    public List<CctvTrack> getTracks(@PathVariable("id") String id) {
        return cctvService.getTracksForAnalysis(id);
    }

    @PostMapping("/tracks/{trackId}/review")
    public EvidenceReviewDecision reviewTrack(
            @PathVariable("trackId") String trackId,
            @RequestBody CctvTrackReviewRequest reqBody,
            HttpServletRequest req
    ) {
        checkCanEdit(req);
        if (reqBody.decision() == null || reqBody.decision().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decision is required");
        }
        return cctvService.reviewTrack(trackId, reqBody.decision(), reqBody.notes(), currentUser(req));
    }

    @PostMapping("/tracks/{trackId}/search-similar")
    public VisualSearchResponse searchSimilar(
            @PathVariable("trackId") String trackId,
            @RequestParam(value = "threshold", required = false) Double threshold,
            @RequestParam(value = "topK", required = false) Integer topK,
            HttpServletRequest req
    ) {
        return cctvService.searchSimilarCrop(trackId, threshold, topK, currentUser(req));
    }
}
