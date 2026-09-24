package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

import static systems.nexus.Model.*;

@Service
@Transactional
public class VisionService {
    private final Store store;
    private final EngineClient engine;
    private final InvestigationService investigationService;
    private final ObjectMapper json;
    private final double defaultThreshold;
    private final String demoDir;

    public VisionService(
            Store store,
            EngineClient engine,
            InvestigationService investigationService,
            ObjectMapper json,
            @Value("${nexus.vision.similarity-threshold:0.65}") double defaultThreshold,
            @Value("${nexus.demo-dir:../data/demo}") String demoDir
    ) {
        this.store = store;
        this.engine = engine;
        this.investigationService = investigationService;
        this.json = json;
        this.defaultThreshold = defaultThreshold;
        this.demoDir = demoDir;
    }

    public static double cosineSimilarity(JsonNode a, JsonNode b) {
        if (a == null || b == null || !a.isArray() || !b.isArray() || a.size() != b.size() || a.isEmpty()) {
            return 0.0;
        }
        double dot = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i < a.size(); i++) {
            double x = a.get(i).asDouble();
            double y = b.get(i).asDouble();
            dot += x * y;
            normA += x * x;
            normB += y * y;
        }
        double denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom == 0.0 ? 0.0 : Math.max(-1.0, Math.min(1.0, dot / denom));
    }

    private String canonical(String id) {
        var aliases = store.state("aliases");
        var seen = new HashSet<String>();
        while (aliases.has(id) && seen.add(id)) id = aliases.path(id).asText();
        return id;
    }

    public Node findPerson(String personNodeId) {
        String canon = canonical(personNodeId);
        return investigationService.graph().nodes().stream()
                .filter(n -> n.type().equals("Person") && (n.id().equals(canon) || n.id().equals(personNodeId)))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Person node not found in active graph"));
    }

    public PersonFace enrollFace(String personNodeId, byte[] imageBytes, String filename, String user) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("Image content must not be empty");
        }
        if (imageBytes.length > 10 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Image exceeds 10 MiB limit");
        }

        Node person = findPerson(personNodeId);
        String personId = person.id();

        JsonNode response;
        try {
            response = engine.visionEnroll(imageBytes);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Face enrollment failed: " + e.getMessage());
        }

        if (response == null || !response.has("embedding") || !response.get("embedding").isArray()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "No usable face detected for enrollment");
        }

        String imageHash = response.path("image_hash").asText(Store.sha256(Base64.getEncoder().encodeToString(imageBytes)));
        String modelName = response.path("model_name").asText("adaface_ir101_webface12m");
        String modelVersion = response.path("model_version").asText("1.0.0");
        double qualityScore = response.path("quality").path("overall_quality").asDouble(1.0);
        String faceId = "face-" + UUID.randomUUID().toString().substring(0, 16);

        ObjectNode metadata = json.createObjectNode();
        metadata.put("filename", filename == null ? "unnamed.jpg" : filename);
        metadata.put("thumbnail", response.path("thumbnail").asText(""));
        if (response.has("bbox")) metadata.set("bbox", response.get("bbox"));
        if (response.has("quality")) metadata.set("quality", response.get("quality"));
        metadata.put("personLabel", person.label());

        PersonFace face = new PersonFace(
                faceId,
                personId,
                imageHash,
                response.get("embedding"),
                modelName,
                modelVersion,
                Instant.now().toString(),
                "",
                qualityScore,
                metadata
        );

        store.addFace(face);
        store.audit("vision:enroll", user, personId, imageHash);
        return face;
    }

    public List<PersonFace> getFaces(String personNodeId) {
        Node person = findPerson(personNodeId);
        return store.facesForPerson(person.id());
    }

    public boolean deleteFace(String faceId, String user) {
        Optional<PersonFace> existing = store.face(faceId);
        if (existing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Face record not found");
        }
        PersonFace f = existing.get();
        boolean deleted = store.deleteFace(faceId);
        if (deleted) {
            store.audit("vision:delete", user, f.personNodeId(), f.imageHash());
        }
        return deleted;
    }

    public List<PersonFace> allFaces() {
        return store.faces();
    }

    public VisionSearchResult search(byte[] imageBytes, String filename, Integer selectedFaceIndex, Double customThreshold, String user) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("Image content must not be empty");
        }
        if (imageBytes.length > 10 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Image exceeds 10 MiB limit");
        }

        double threshold = customThreshold != null ? customThreshold : defaultThreshold;
        String imageHash = Store.sha256(Base64.getEncoder().encodeToString(imageBytes));

        JsonNode response;
        try {
            response = engine.visionSearch(imageBytes, selectedFaceIndex, 0.45);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Vision engine search failed: " + e.getMessage());
        }

        String status = response.path("status").asText("NO_FACE_DETECTED");
        int facesDetected = response.path("faces_detected").asInt(0);
        String modelName = response.path("model_name").asText("adaface_ir101_webface12m");

        List<Map<String, Object>> detectedFaces = new ArrayList<>();
        if (response.has("faces") && response.get("faces").isArray()) {
            for (JsonNode f : response.get("faces")) {
                Map<String, Object> fm = new LinkedHashMap<>();
                fm.put("faceIndex", f.path("face_index").asInt());
                fm.put("score", f.path("score").asDouble());
                fm.put("thumbnail", f.path("thumbnail").asText(""));
                fm.put("bbox", json.convertValue(f.path("bbox"), Map.class));
                fm.put("quality", json.convertValue(f.path("quality"), Map.class));
                detectedFaces.add(fm);
            }
        }

        if ("NO_FACE_DETECTED".equals(status) || facesDetected == 0) {
            store.audit("vision:search:no_face", user, "", imageHash);
            return new VisionSearchResult("NO_FACE_DETECTED", 0, threshold, modelName, imageHash, List.of(), detectedFaces, null);
        }

        if ("MULTIPLE_FACES".equals(status) && (selectedFaceIndex == null || selectedFaceIndex < 0)) {
            store.audit("vision:search:multiple_faces", user, "", imageHash);
            return new VisionSearchResult("MULTIPLE_FACES", facesDetected, threshold, modelName, imageHash, List.of(), detectedFaces, null);
        }

        JsonNode queryEmbedding = response.get("embedding");
        if (queryEmbedding == null || !queryEmbedding.isArray()) {
            return new VisionSearchResult("LOW_QUALITY", facesDetected, threshold, modelName, imageHash, List.of(), detectedFaces, null);
        }

        String alignedThumbnail = response.path("aligned_thumbnail").asText("");
        Map<String, Object> queryQuality = response.has("quality") ? json.convertValue(response.get("quality"), Map.class) : Map.of();

        List<PersonFace> enrolled = store.faces();
        Graph graph = investigationService.graph();

        // Group enrolled faces by person to pick the best similarity match per person
        Map<String, List<PersonFace>> byPerson = new LinkedHashMap<>();
        for (PersonFace pf : enrolled) {
            byPerson.computeIfAbsent(pf.personNodeId(), k -> new ArrayList<>()).add(pf);
        }

        List<FaceCandidate> candidates = new ArrayList<>();
        for (var entry : byPerson.entrySet()) {
            String personNodeId = entry.getKey();
            List<PersonFace> personFaces = entry.getValue();

            double bestSim = -1.0;
            PersonFace bestFace = null;
            for (PersonFace pf : personFaces) {
                double sim = cosineSimilarity(queryEmbedding, pf.embedding());
                if (sim > bestSim) {
                    bestSim = sim;
                    bestFace = pf;
                }
            }

            if (bestSim >= threshold && bestFace != null) {
                Map<String, Object> personContext = resolvePersonContext(personNodeId, graph, bestFace);
                String matchStatus = bestSim >= 0.80 ? "STRONG_CANDIDATE" : "CANDIDATE";
                candidates.add(new FaceCandidate(
                        personNodeId,
                        Math.round(bestSim * 1000.0) / 1000.0,
                        matchStatus,
                        modelName,
                        bestFace.id(),
                        personContext,
                        queryQuality
                ));
            }
        }

        candidates.sort(Comparator.comparingDouble(FaceCandidate::similarity).reversed());
        String finalStatus = candidates.isEmpty() ? "NO_MATCH" : "MATCH_CANDIDATE";

        store.audit(
                "vision:search",
                user,
                candidates.isEmpty() ? "" : candidates.get(0).personNodeId(),
                imageHash
        );

        return new VisionSearchResult(
                finalStatus,
                facesDetected,
                threshold,
                modelName,
                imageHash,
                candidates,
                detectedFaces,
                alignedThumbnail
        );
    }

    private Map<String, Object> resolvePersonContext(String personNodeId, Graph g, PersonFace face) {
        String canon = canonical(personNodeId);
        Node personNode = g.nodes().stream()
                .filter(n -> n.id().equals(canon) || n.id().equals(personNodeId))
                .findFirst()
                .orElse(null);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", personNodeId);
        res.put("canonicalId", canon);
        res.put("label", personNode != null ? personNode.label() : "Unknown");
        res.put("type", "Person");

        // Reference photo from face metadata
        String refPhoto = face.metadata().path("thumbnail").asText("");
        res.put("referencePhoto", refPhoto);
        res.put("faceEnrolledAt", face.createdAt());
        res.put("qualityScore", face.qualityScore());

        if (personNode == null) {
            return res;
        }

        // Roles & Corroboration
        res.put("roles", personNode.properties().getOrDefault("roles", List.of()));
        res.put("corroboration", personNode.properties().getOrDefault("corroboration", ""));

        // Linked Cases
        List<String> caseIds = new ArrayList<>();
        if (personNode.properties().containsKey("caseIds")) {
            @SuppressWarnings("unchecked")
            List<String> c = (List<String>) personNode.properties().get("caseIds");
            caseIds.addAll(c);
        }
        res.put("cases", caseIds.stream().distinct().toList());

        // Connected entities from graph edges
        Set<String> phones = new TreeSet<>();
        Set<String> accounts = new TreeSet<>();
        Set<String> vehicles = new TreeSet<>();
        Set<String> locations = new TreeSet<>();
        List<Map<String, String>> associates = new ArrayList<>();
        List<Map<String, String>> relationships = new ArrayList<>();

        for (Edge e : g.edges()) {
            boolean isSource = e.source().equals(personNodeId) || e.source().equals(canon);
            boolean isTarget = e.target().equals(personNodeId) || e.target().equals(canon);
            if (!isSource && !isTarget) continue;

            String otherId = isSource ? e.target() : e.source();
            Node otherNode = g.nodes().stream().filter(n -> n.id().equals(otherId)).findFirst().orElse(null);
            if (otherNode == null) continue;

            switch (otherNode.type()) {
                case "Phone" -> phones.add(otherNode.label());
                case "Account" -> accounts.add(otherNode.label());
                case "Vehicle" -> vehicles.add(otherNode.label());
                case "Location" -> locations.add(otherNode.label());
                case "Person" -> {
                    associates.add(Map.of("id", otherNode.id(), "label", otherNode.label(), "relation", e.type()));
                }
            }
            relationships.add(Map.of("type", e.type(), "target", otherNode.label(), "targetType", otherNode.type()));
        }

        res.put("phones", new ArrayList<>(phones));
        res.put("accounts", new ArrayList<>(accounts));
        res.put("vehicles", new ArrayList<>(vehicles));
        res.put("locations", new ArrayList<>(locations));
        res.put("associates", associates);
        res.put("relationships", relationships);

        // Active alerts mentioning this person
        int alertCount = 0;
        if (g.analysis() != null && g.analysis().has("alerts")) {
            for (JsonNode a : g.analysis().path("alerts")) {
                if (a.path("suppressed").asBoolean(false)) continue;
                for (JsonNode eid : a.path("entityIds")) {
                    if (eid.asText().equals(personNodeId) || eid.asText().equals(canon)) {
                        alertCount++;
                        break;
                    }
                }
            }
        }
        res.put("activeAlertsCount", alertCount);

        // Aliases from state
        List<String> aliases = new ArrayList<>();
        JsonNode aliasesState = store.state("aliases");
        aliasesState.fields().forEachRemaining(entry -> {
            if (entry.getValue().asText().equals(canon) || entry.getValue().asText().equals(personNodeId)) {
                Node aliasNode = g.nodes().stream().filter(n -> n.id().equals(entry.getKey())).findFirst().orElse(null);
                if (aliasNode != null && !aliasNode.label().equals(personNode.label())) {
                    aliases.add(aliasNode.label());
                }
            }
        });
        res.put("aliases", aliases);

        return res;
    }

    public FaceDecision recordDecision(FaceDecisionRequest req, String user) {
        if (req == null) {
            throw new IllegalArgumentException("Decision request is required");
        }
        String dec = req.decision() == null ? "" : req.decision().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("CONFIRMED", "REJECTED").contains(dec)) {
            throw new IllegalArgumentException("Decision must be either CONFIRMED or REJECTED");
        }

        Node person = findPerson(req.personNodeId());
        String decisionId = "dec-" + UUID.randomUUID().toString().substring(0, 16);
        String now = Instant.now().toString();

        FaceDecision decision = new FaceDecision(
                decisionId,
                person.id(),
                dec,
                req.similarity() != null ? req.similarity() : 0.0,
                req.modelName() != null ? req.modelName() : "adaface_ir101_webface12m",
                req.imageHash() != null ? req.imageHash() : "",
                req.notes() != null ? req.notes() : "",
                user,
                now
        );

        store.addFaceDecision(decision);
        String digest = Store.sha256(dec + ":" + req.similarity() + ":" + req.imageHash() + ":" + (req.notes() != null ? req.notes() : ""));
        store.audit("vision:decision:" + dec.toLowerCase(), user, person.id(), digest);

        return decision;
    }

    public List<FaceDecision> decisions() {
        return store.faceDecisions();
    }

    public List<FaceDecision> decisionsForPerson(String personNodeId) {
        Node person = findPerson(personNodeId);
        return store.faceDecisionsForPerson(person.id());
    }

    public Map<String, Object> demoEnroll(String user) {
        Graph g = investigationService.graph();
        List<Node> people = g.nodes().stream().filter(n -> n.type().equals("Person")).toList();
        if (people.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No Person nodes found in workspace. Load the demo dataset first.");
        }

        int enrolled = 0;
        List<Map<String, Object>> enrolledItems = new ArrayList<>();
        Map<String, String> fixtureMap = Map.of(
                "aariv", "aariv_veylan_ref.jpg",
                "mira", "mira_solven_ref.jpg",
                "dev", "dev_neral_ref.jpg"
        );

        for (Node p : people) {
            if (!store.facesForPerson(p.id()).isEmpty()) {
                continue;
            }

            String matchKey = p.label().toLowerCase(Locale.ROOT);
            String fixtureFile = null;
            for (var entry : fixtureMap.entrySet()) {
                if (matchKey.contains(entry.getKey()) || entry.getKey().contains(matchKey)) {
                    fixtureFile = entry.getValue();
                    break;
                }
            }

            try {
                byte[] imageBytes = null;
                if (fixtureFile != null) {
                    var res = new org.springframework.core.io.ClassPathResource("fixtures/faces/" + fixtureFile);
                    if (res.exists()) {
                        imageBytes = res.getInputStream().readAllBytes();
                    }
                }
                if (imageBytes == null) {
                    imageBytes = generateSyntheticFaceImage(p.label());
                }

                PersonFace face = enrollFace(p.id(), imageBytes, fixtureFile != null ? fixtureFile : (p.label().replace(" ", "_").toLowerCase() + "_ref.jpg"), user);
                enrolled++;
                enrolledItems.add(Map.of(
                        "personId", p.id(),
                        "name", p.label(),
                        "faceId", face.id()
                ));
            } catch (Exception e) {
                // Ignore individual failure during batch demo enrollment
            }
        }

        store.audit("vision:demo:enroll", user, "", String.valueOf(enrolled));
        return Map.of(
                "status", "ok",
                "enrolledCount", enrolled,
                "items", enrolledItems
        );
    }

    public List<Map<String, Object>> sampleFixtures() {
        List<Map<String, String>> items = List.of(
                Map.of("id", "cctv_aariv", "label", "Aariv Veylan (Surveillance CCTV)", "filename", "aariv_veylan_cctv.jpg", "description", "Degraded 160x200 surveillance crop with sensor noise & compression"),
                Map.of("id", "ref_mira", "label", "Mira Solven (Reference Photo)", "filename", "mira_solven_ref.jpg", "description", "Clear reference portrait of enrolled co-accused"),
                Map.of("id", "crowd_two", "label", "Multi-Person Scene (2 Faces)", "filename", "multi_face_crowd.jpg", "description", "Image containing multiple faces testing face selector"),
                Map.of("id", "unknown", "label", "Unknown Suspect (Unenrolled)", "filename", "unknown_suspect.jpg", "description", "Face not enrolled in NEXUS identity gallery"),
                Map.of("id", "doc_no_face", "label", "Police Report (No Face)", "filename", "no_face_doc.jpg", "description", "Document header and text lines without human face")
        );

        List<Map<String, Object>> result = new ArrayList<>();
        for (var item : items) {
            try {
                org.springframework.core.io.Resource res = new org.springframework.core.io.ClassPathResource("fixtures/faces/" + item.get("filename"));
                if (res.exists()) {
                    byte[] bytes = res.getInputStream().readAllBytes();
                    String b64 = Base64.getEncoder().encodeToString(bytes);
                    Map<String, Object> entry = new LinkedHashMap<>(item);
                    entry.put("dataUrl", "data:image/jpeg;base64," + b64);
                    entry.put("sizeBytes", bytes.length);
                    result.add(entry);
                }
            } catch (Exception ignored) {}
        }
        return result;
    }

    public static byte[] generateSyntheticFaceImage(String seedName) {
        // Generates an RGB face portrait using OpenCV
        int size = 250;
        int seed = Math.abs(seedName.hashCode());
        Random rnd = new Random(seed);

        int skinR = 190 + rnd.nextInt(40);
        int skinG = 150 + rnd.nextInt(35);
        int skinB = 120 + rnd.nextInt(30);

        // Simple colored image buffer
        byte[] bgr = new byte[size * size * 3];
        Arrays.fill(bgr, (byte) 240); // light background

        // Draw head oval, eyes, nose, mouth using mathematical coordinates
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                int dx = x - size / 2;
                int dy = y - size / 2;
                // Head ellipse (radius x=60, y=80)
                if ((dx * dx) / (60.0 * 60.0) + (dy * dy) / (80.0 * 80.0) <= 1.0) {
                    int idx = (y * size + x) * 3;
                    bgr[idx] = (byte) skinB;
                    bgr[idx + 1] = (byte) skinG;
                    bgr[idx + 2] = (byte) skinR;
                }
                // Eyes (left: -22, -15; right: +22, -15; radius: 7)
                int edx1 = x - (size / 2 - 22), edy1 = y - (size / 2 - 15);
                int edx2 = x - (size / 2 + 22), edy2 = y - (size / 2 - 15);
                if (edx1 * edx1 + edy1 * edy1 <= 49 || edx2 * edx2 + edy2 * edy2 <= 49) {
                    int idx = (y * size + x) * 3;
                    bgr[idx] = 30;
                    bgr[idx + 1] = 30;
                    bgr[idx + 2] = 30;
                }
                // Nose tip (center: 0, +10; radius: 5)
                int ndx = x - size / 2, ndy = y - (size / 2 + 10);
                if (ndx * ndx + ndy * ndy <= 25) {
                    int idx = (y * size + x) * 3;
                    bgr[idx] = (byte) (skinB - 30);
                    bgr[idx + 1] = (byte) (skinG - 30);
                    bgr[idx + 2] = (byte) (skinR - 30);
                }
                // Mouth (center: 0, +38; width: 22, height: 6)
                int mdx = x - size / 2, mdy = y - (size / 2 + 38);
                if ((mdx * mdx) / (22.0 * 22.0) + (mdy * mdy) / (6.0 * 6.0) <= 1.0) {
                    int idx = (y * size + x) * 3;
                    bgr[idx] = 60;
                    bgr[idx + 1] = 60;
                    bgr[idx + 2] = (byte) 160;
                }
            }
        }

        // Encode as uncompressed BMP or JPEG
        try {
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(size, size, java.awt.image.BufferedImage.TYPE_3BYTE_BGR);
            img.getRaster().setDataElements(0, 0, size, size, bgr);
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to synthesize demo face image: " + e.getMessage());
        }
    }
}
