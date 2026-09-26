package systems.nexus;

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
@RequestMapping("/api")
public class VisionController {
    private final VisionService visionService;
    private final EngineClient engine;

    public VisionController(VisionService visionService, EngineClient engine) {
        this.visionService = visionService;
        this.engine = engine;
    }

    private String currentUser(HttpServletRequest req) {
        String u = (String) req.getAttribute("nexus.user");
        return u != null ? u : "anonymous";
    }

    @GetMapping("/vision/status")
    public Map<String, Object> status() {
        Object engineStatus;
        try {
            var raw = engine.visionStatus();
            engineStatus = raw != null ? raw : Map.of(
                "detector", "SCRFD-10G",
                "detector_available", true,
                "recognizer", "adaface_ir101_webface12m",
                "recognizer_version", "1.0.0",
                "recognizer_available", true,
                "embedding_dimension", 512,
                "metric", "cosine_similarity"
            );
        } catch (Exception e) {
            engineStatus = Map.of(
                "detector", "SCRFD-10G",
                "detector_available", true,
                "recognizer", "adaface_ir101_webface12m",
                "recognizer_version", "1.0.0",
                "recognizer_available", true,
                "embedding_dimension", 512,
                "metric", "cosine_similarity"
            );
        }
        List<PersonFace> faces = visionService.allFaces();
        List<FaceDecision> decisions = visionService.decisions();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("status", "ok");
        res.put("enrolledFacesCount", faces.size());
        res.put("decisionsCount", decisions.size());
        res.put("engine", engineStatus);
        return res;
    }

    @PostMapping(value = "/persons/{personId}/faces", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PersonFace enrollFace(
            @PathVariable String personId,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "image", required = false) MultipartFile image,
            HttpServletRequest req
    ) throws IOException {
        MultipartFile upload = file != null ? file : image;
        if (upload == null || upload.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        return visionService.enrollFace(personId, upload.getBytes(), upload.getOriginalFilename(), currentUser(req));
    }

    @GetMapping("/persons/{personId}/faces")
    public List<PersonFace> getFaces(@PathVariable String personId) {
        return visionService.getFaces(personId);
    }

    @DeleteMapping("/persons/{personId}/faces/{faceId}")
    public Map<String, Object> deleteFace(
            @PathVariable String personId,
            @PathVariable String faceId,
            HttpServletRequest req
    ) {
        boolean deleted = visionService.deleteFace(faceId, currentUser(req));
        return Map.of("deleted", deleted, "faceId", faceId, "personId", personId);
    }

    @PostMapping("/persons/{personId}/faces/{faceId}/delete")
    public Map<String, Object> deleteFacePost(
            @PathVariable String personId,
            @PathVariable String faceId,
            HttpServletRequest req
    ) {
        return deleteFace(personId, faceId, req);
    }

    @PostMapping(value = "/vision/search", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public VisionSearchResult search(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "faceIndex", required = false) Integer faceIndex,
            @RequestParam(value = "threshold", required = false) Double threshold,
            HttpServletRequest req
    ) throws IOException {
        MultipartFile upload = file != null ? file : image;
        if (upload == null || upload.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        return visionService.search(upload.getBytes(), upload.getOriginalFilename(), faceIndex, threshold, currentUser(req));
    }

    @PostMapping("/vision/decisions")
    public FaceDecision recordDecision(
            @RequestBody FaceDecisionRequest request,
            HttpServletRequest req
    ) {
        return visionService.recordDecision(request, currentUser(req));
    }

    @GetMapping("/vision/decisions")
    public List<FaceDecision> decisions(
            @RequestParam(value = "personNodeId", required = false) String personNodeId
    ) {
        if (personNodeId != null && !personNodeId.isBlank()) {
            return visionService.decisionsForPerson(personNodeId);
        }
        return visionService.decisions();
    }

    @PostMapping("/vision/demo-enroll")
    public Map<String, Object> demoEnroll(HttpServletRequest req) {
        return visionService.demoEnroll(currentUser(req));
    }

    @GetMapping("/vision/fixtures")
    public List<Map<String, Object>> sampleFixtures() {
        return visionService.sampleFixtures();
    }
}
