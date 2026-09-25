package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;

import static systems.nexus.Model.*;

@Service
@Transactional
public class EvidenceService {
    private final Store store;
    private final EngineClient engine;
    private final ObjectMapper json;
    private final Path storageRoot;
    private final InvestigationService investigationService;

    @org.springframework.beans.factory.annotation.Autowired
    public EvidenceService(
            Store store,
            EngineClient engine,
            ObjectMapper json,
            InvestigationService investigationService,
            @Value("${nexus.evidence.storage-dir:data/evidence}") String storageDir
    ) {
        this.store = store;
        this.engine = engine;
        this.json = json;
        this.investigationService = investigationService;
        this.storageRoot = Paths.get(storageDir).toAbsolutePath();
        try {
            Files.createDirectories(this.storageRoot);
        } catch (IOException e) {
            // fallback to tmp
        }
    }

    public EvidenceService(
            Store store,
            EngineClient engine,
            ObjectMapper json,
            String storageDir
    ) {
        this(store, engine, json, null, storageDir);
    }

    public static String detectMediaType(String filename, String mimeType) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".pdf") || lower.endsWith(".txt") || lower.endsWith(".doc") || lower.endsWith(".docx")) {
            return "DOCUMENT";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".bmp")) {
            return "IMAGE";
        }
        if (lower.endsWith(".wav") || lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".ogg") || lower.endsWith(".aac")) {
            return "AUDIO";
        }
        if (lower.endsWith(".mp4") || lower.endsWith(".avi") || lower.endsWith(".mov") || lower.endsWith(".mkv") || lower.endsWith(".webm")) {
            return "VIDEO";
        }
        if (mimeType != null) {
            if (mimeType.contains("pdf") || mimeType.contains("text")) return "DOCUMENT";
            if (mimeType.contains("image")) return "IMAGE";
            if (mimeType.contains("audio")) return "AUDIO";
            if (mimeType.contains("video")) return "VIDEO";
        }
        return "DOCUMENT";
    }

    public EvidenceAsset uploadEvidence(
            byte[] fileBytes,
            String originalFilename,
            String caseId,
            String mediaType,
            String description,
            String user,
            boolean autoAnalyze
    ) {
        if (fileBytes == null || fileBytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Evidence file cannot be empty");
        }
        if (fileBytes.length > 30 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Evidence file exceeds 30 MiB limit");
        }

        String safeCaseId = (caseId != null && !caseId.isBlank()) ? caseId.trim() : "NXS-007";
        String safeFilename = (originalFilename != null && !originalFilename.isBlank()) ? originalFilename.trim() : "evidence.bin";
        String resolvedMediaType = (mediaType != null && !mediaType.isBlank()) ? mediaType.toUpperCase() : detectMediaType(safeFilename, null);

        String assetId = "AST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String fileHash = Store.sha256(Base64.getEncoder().encodeToString(fileBytes));

        Path targetPath = storageRoot.resolve(assetId + "_" + safeFilename.replaceAll("[^a-zA-Z0-9._-]", "_"));
        try {
            Files.write(targetPath, fileBytes);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to persist evidence asset file");
        }

        ObjectNode metadata = json.createObjectNode();
        metadata.put("description", description != null ? description : "");
        metadata.put("originalFilename", safeFilename);
        metadata.put("uploadedAt", Instant.now().toString());

        EvidenceAsset asset = new EvidenceAsset(
                assetId,
                safeCaseId,
                safeFilename,
                resolvedMediaType,
                resolvedMediaType.equals("DOCUMENT") ? "application/pdf" : (resolvedMediaType.equals("IMAGE") ? "image/jpeg" : (resolvedMediaType.equals("AUDIO") ? "audio/wav" : "video/mp4")),
                fileBytes.length,
                fileHash,
                targetPath.toString(),
                "UPLOADED",
                Instant.now().toString(),
                user,
                metadata
        );

        store.saveEvidenceAsset(asset);
        store.audit("EVIDENCE_UPLOAD", user, assetId, fileHash);

        if (autoAnalyze) {
            try {
                if ("DOCUMENT".equals(resolvedMediaType)) {
                    analyzeDocument(assetId, user);
                } else if ("AUDIO".equals(resolvedMediaType)) {
                    analyzeAudio(assetId, user);
                } else if ("IMAGE".equals(resolvedMediaType) || "VIDEO".equals(resolvedMediaType)) {
                    analyzeVisual(assetId, user);
                }
                return store.evidenceAsset(assetId).orElse(asset);
            } catch (Exception e) {
                // If auto-analysis fails, asset remains saved in UPLOADED status
            }
        }

        return asset;
    }

    public List<EvidenceAsset> listAssets(String caseId, String mediaType) {
        if (caseId != null && !caseId.isBlank()) {
            List<EvidenceAsset> list = store.evidenceAssetsByCase(caseId);
            if (mediaType != null && !mediaType.isBlank()) {
                return list.stream().filter(a -> a.mediaType().equalsIgnoreCase(mediaType)).toList();
            }
            return list;
        }
        List<EvidenceAsset> all = store.evidenceAssets();
        if (mediaType != null && !mediaType.isBlank()) {
            return all.stream().filter(a -> a.mediaType().equalsIgnoreCase(mediaType)).toList();
        }
        return all;
    }

    public Map<String, Object> getAssetDetail(String assetId) {
        EvidenceAsset asset = store.evidenceAsset(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence asset not found: " + assetId));
        List<EvidenceItem> items = store.evidenceItemsByAsset(assetId);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("asset", asset);
        detail.put("items", items);
        detail.put("itemCount", items.size());
        return detail;
    }

    public Map<String, Object> analyzeDocument(String assetId, String user) {
        EvidenceAsset asset = store.evidenceAsset(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence asset not found: " + assetId));

        byte[] bytes = readFileBytes(asset.storagePath());
        JsonNode ocrRes;
        try {
            ocrRes = engine.evidenceDocumentOcr(bytes, asset.fileName(), assetId);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OCR engine communication failed: " + e.getMessage());
        }

        // Save extracted pages/text lines
        String combinedText = ocrRes.path("combinedText").asText("");
        String modelName = ocrRes.path("model").asText("PaddleOCR-PP-OCRv5");

        EvidenceItem textItem = new EvidenceItem(
                "ITM-TXT-" + assetId,
                assetId,
                "DOCUMENT_TEXT",
                ocrRes.path("pageCount").asInt(1),
                0.0,
                0.0,
                "",
                combinedText,
                0.95,
                json.createArrayNode(),
                modelName,
                ocrRes.path("provenance"),
                Instant.now().toString()
        );
        store.saveEvidenceItem(textItem);

        // Save extracted entities
        JsonNode entitiesNode = ocrRes.path("entities");
        if (entitiesNode.isArray()) {
            for (int i = 0; i < entitiesNode.size(); i++) {
                JsonNode ent = entitiesNode.get(i);
                EvidenceItem entItem = new EvidenceItem(
                        "ITM-ENT-" + assetId + "-" + (i + 1),
                        assetId,
                        "EXTRACTED_ENTITY",
                        ent.path("pageNumber").asInt(1),
                        0.0,
                        0.0,
                        "",
                        ent.path("raw").asText("") + " (" + ent.path("type").asText("") + ")",
                        ent.path("confidence").asDouble(0.95),
                        json.createArrayNode(),
                        modelName,
                        ent,
                        Instant.now().toString()
                );
                store.saveEvidenceItem(entItem);
            }
        }

        // Update asset status
        EvidenceAsset updated = new EvidenceAsset(
                asset.id(), asset.caseId(), asset.fileName(), asset.mediaType(), asset.mimeType(),
                asset.fileSize(), asset.fileHash(), asset.storagePath(), "ANALYZED",
                asset.createdAt(), asset.createdBy(), asset.metadata()
        );
        store.saveEvidenceAsset(updated);
        store.audit("EVIDENCE_DOCUMENT_OCR", user, assetId, Store.sha256(combinedText));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("assetId", assetId);
        res.put("status", "ANALYZED");
        res.put("ocrResult", ocrRes);
        return res;
    }

    public Map<String, Object> analyzeAudio(String assetId, String user) {
        EvidenceAsset asset = store.evidenceAsset(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence asset not found: " + assetId));

        byte[] bytes = readFileBytes(asset.storagePath());
        JsonNode audioRes;
        try {
            audioRes = engine.evidenceAudioTranscribe(bytes, asset.fileName(), assetId);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Audio intelligence communication failed: " + e.getMessage());
        }

        String fullTranscript = audioRes.path("fullTranscript").asText("");
        String modelName = audioRes.path("model").asText("faster-whisper-small-int8");

        EvidenceItem transcriptItem = new EvidenceItem(
                "ITM-AUD-" + assetId,
                assetId,
                "AUDIO_TRANSCRIPT",
                0,
                0.0,
                audioRes.path("durationSeconds").asDouble(0.0),
                "",
                fullTranscript,
                0.95,
                json.createArrayNode(),
                modelName,
                audioRes.path("provenance"),
                Instant.now().toString()
        );
        store.saveEvidenceItem(transcriptItem);

        // Save segments
        JsonNode segments = audioRes.path("segments");
        if (segments.isArray()) {
            for (int i = 0; i < segments.size(); i++) {
                JsonNode seg = segments.get(i);
                EvidenceItem segItem = new EvidenceItem(
                        "ITM-SEG-" + assetId + "-" + (i + 1),
                        assetId,
                        "AUDIO_SEGMENT",
                        0,
                        seg.path("start").asDouble(0.0),
                        seg.path("end").asDouble(0.0),
                        seg.path("speaker").asText("SPEAKER_00"),
                        seg.path("text").asText(""),
                        seg.path("confidence").asDouble(0.95),
                        json.createArrayNode(),
                        modelName,
                        seg,
                        Instant.now().toString()
                );
                store.saveEvidenceItem(segItem);
            }
        }

        // Save extracted entities from audio
        JsonNode entities = audioRes.path("entities");
        if (entities.isArray()) {
            for (int i = 0; i < entities.size(); i++) {
                JsonNode ent = entities.get(i);
                EvidenceItem entItem = new EvidenceItem(
                        "ITM-AENT-" + assetId + "-" + (i + 1),
                        assetId,
                        "EXTRACTED_ENTITY",
                        0,
                        ent.path("timestampStart").asDouble(0.0),
                        ent.path("timestampEnd").asDouble(0.0),
                        ent.path("speaker").asText("SPEAKER_00"),
                        ent.path("raw").asText("") + " (" + ent.path("type").asText("") + ")",
                        ent.path("confidence").asDouble(0.95),
                        json.createArrayNode(),
                        modelName,
                        ent,
                        Instant.now().toString()
                );
                store.saveEvidenceItem(entItem);
            }
        }

        EvidenceAsset updated = new EvidenceAsset(
                asset.id(), asset.caseId(), asset.fileName(), asset.mediaType(), asset.mimeType(),
                asset.fileSize(), asset.fileHash(), asset.storagePath(), "ANALYZED",
                asset.createdAt(), asset.createdBy(), asset.metadata()
        );
        store.saveEvidenceAsset(updated);
        store.audit("EVIDENCE_AUDIO_TRANSCRIBE", user, assetId, Store.sha256(fullTranscript));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("assetId", assetId);
        res.put("status", "ANALYZED");
        res.put("audioResult", audioRes);
        return res;
    }

    public Map<String, Object> analyzeVisual(String assetId, String user) {
        EvidenceAsset asset = store.evidenceAsset(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence asset not found: " + assetId));

        byte[] bytes = readFileBytes(asset.storagePath());
        JsonNode visualRes;
        try {
            visualRes = engine.evidenceVisualEmbed(bytes, asset.fileName(), asset.mediaType(), assetId, asset.caseId());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Visual evidence engine failed: " + e.getMessage());
        }

        String modelName = visualRes.path("model").asText("OpenCLIP-ViT-B-32-laion2b_s34b_b79k");
        JsonNode frames = visualRes.path("frames");
        if (frames.isArray()) {
            for (int i = 0; i < frames.size(); i++) {
                JsonNode f = frames.get(i);
                ObjectNode prov = json.createObjectNode();
                prov.put("thumbnail", f.path("thumbnail").asText(""));
                prov.put("caseId", asset.caseId());
                prov.put("model", modelName);

                EvidenceItem frameItem = new EvidenceItem(
                        "ITM-VIS-" + assetId + "-" + (i + 1),
                        assetId,
                        "VISUAL_EMBEDDING",
                        f.path("frameIndex").asInt(i),
                        f.path("timestamp").asDouble(0.0),
                        f.path("timestamp").asDouble(0.0),
                        "",
                        "Visual Frame " + f.path("frameIndex").asInt(i) + " (" + asset.mediaType() + ")",
                        1.0,
                        f.path("embedding"),
                        modelName,
                        prov,
                        Instant.now().toString()
                );
                store.saveEvidenceItem(frameItem);
            }
        }

        EvidenceAsset updated = new EvidenceAsset(
                asset.id(), asset.caseId(), asset.fileName(), asset.mediaType(), asset.mimeType(),
                asset.fileSize(), asset.fileHash(), asset.storagePath(), "ANALYZED",
                asset.createdAt(), asset.createdBy(), asset.metadata()
        );
        store.saveEvidenceAsset(updated);
        store.audit("EVIDENCE_VISUAL_EMBED", user, assetId, asset.fileHash());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("assetId", assetId);
        res.put("status", "ANALYZED");
        res.put("visualResult", visualRes);
        return res;
    }

    public VisualSearchResponse visualSearch(
            byte[] queryBytes,
            String queryAssetId,
            Double threshold,
            Integer topK,
            String user
    ) {
        double thresh = threshold != null ? threshold : 0.50;
        int limit = topK != null ? topK : 15;

        List<Double> queryEmbedding = new ArrayList<>();
        if (queryAssetId != null && !queryAssetId.isBlank()) {
            List<EvidenceItem> items = store.evidenceItemsByAsset(queryAssetId);
            for (var it : items) {
                if (it.embedding() != null && it.embedding().isArray() && !it.embedding().isEmpty()) {
                    for (JsonNode val : it.embedding()) queryEmbedding.add(val.asDouble());
                    break;
                }
            }
        }

        if (queryEmbedding.isEmpty() && queryBytes != null && queryBytes.length > 0) {
            JsonNode embedRes = engine.evidenceVisualEmbed(queryBytes, "query.jpg", "IMAGE", "QUERY", "");
            JsonNode primary = embedRes.path("primaryEmbedding");
            if (primary.isArray()) {
                for (JsonNode val : primary) queryEmbedding.add(val.asDouble());
            }
        }

        if (queryEmbedding.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Either query image file or valid assetId with visual embedding is required");
        }

        // Build gallery of enrolled visual items across all cases
        List<EvidenceItem> allVisual = store.allVisualEvidenceItems();
        List<Map<String, Object>> gallery = new ArrayList<>();
        Map<String, String> assetCaseMap = new HashMap<>();
        for (var a : store.evidenceAssets()) {
            assetCaseMap.put(a.id(), a.caseId());
        }

        for (var v : allVisual) {
            if (queryAssetId != null && queryAssetId.equals(v.assetId())) {
                continue;
            }
            if (v.embedding() != null && v.embedding().isArray() && !v.embedding().isEmpty()) {
                List<Double> emb = new ArrayList<>();
                for (JsonNode val : v.embedding()) emb.add(val.asDouble());

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("assetId", v.assetId());
                item.put("caseId", assetCaseMap.getOrDefault(v.assetId(), "CASE-UNKNOWN"));
                item.put("frameIndex", v.pageOrFrame());
                item.put("timestamp", v.timestampStart());
                item.put("embedding", emb);
                item.put("thumbnail", v.provenance().path("thumbnail").asText(""));
                gallery.add(item);
            }
        }

        List<VisualMatchLead> leads = new ArrayList<>();
        try {
            JsonNode searchRes = engine.evidenceVisualSearch(queryEmbedding, gallery, thresh, limit);
            JsonNode matches = searchRes.path("matches");
            if (matches.isArray()) {
                for (JsonNode m : matches) {
                    leads.add(new VisualMatchLead(
                            m.path("matchAssetId").asText(""),
                            m.path("matchCaseId").asText(""),
                            m.path("matchFrameIndex").asInt(0),
                            m.path("matchTimestamp").asDouble(0.0),
                            m.path("similarity").asDouble(0.0),
                            m.path("similarityScore").asDouble(0.0),
                            m.path("similarityDisplay").asText(""),
                            m.path("leadDisclaimer").asText("Visual similarity lead only. Does not establish physical identity or case connection."),
                            m.path("thumbnail").asText(""),
                            m.path("provenance")
                    ));
                }
            }
        } catch (Exception e) {
            // Java in-memory cosine fallback if engine is unreachable
            leads = inMemoryVisualSearch(queryEmbedding, gallery, thresh, limit);
        }

        store.audit("EVIDENCE_VISUAL_SEARCH", user, queryAssetId != null ? queryAssetId : "query", Store.sha256(queryEmbedding.toString()));
        return new VisualSearchResponse(
                leads,
                leads.size(),
                thresh,
                "Visual similarity indicates investigative lead only. Not proof of identity."
        );
    }

    private List<VisualMatchLead> inMemoryVisualSearch(
            List<Double> queryEmb,
            List<Map<String, Object>> gallery,
            double threshold,
            int topK
    ) {
        List<VisualMatchLead> results = new ArrayList<>();
        for (var item : gallery) {
            @SuppressWarnings("unchecked")
            List<Double> emb = (List<Double>) item.get("embedding");
            if (emb == null || emb.size() != queryEmb.size()) continue;

            double dot = 0.0, normA = 0.0, normB = 0.0;
            for (int i = 0; i < queryEmb.size(); i++) {
                double a = queryEmb.get(i);
                double b = emb.get(i);
                dot += a * b;
                normA += a * a;
                normB += b * b;
            }
            double sim = (normA > 0 && normB > 0) ? (dot / (Math.sqrt(normA) * Math.sqrt(normB))) : 0.0;
            sim = Math.max(-1.0, Math.min(1.0, sim));

            if (sim >= threshold) {
                String cId = (String) item.get("caseId");
                int scoreRound = (int) Math.round(sim * 100.0);
                results.add(new VisualMatchLead(
                        (String) item.get("assetId"),
                        cId,
                        (Integer) item.get("frameIndex"),
                        (Double) item.get("timestamp"),
                        Math.round(sim * 10000.0) / 10000.0,
                        Math.round(sim * 1000.0) / 10.0,
                        cId + " — Visual Similarity " + scoreRound + "/100",
                        "Visual similarity lead only. Does not establish physical identity or case connection.",
                        (String) item.get("thumbnail"),
                        json.createObjectNode().put("method", "Java In-Memory Cosine Fallback")
                ));
            }
        }
        results.sort((a, b) -> Double.compare(b.similarity(), a.similarity()));
        return results.subList(0, Math.min(results.size(), topK));
    }

    public EvidenceReviewDecision recordReviewDecision(String itemId, String decision, String notes, String user) {
        String safeDecision = (decision != null && !decision.isBlank()) ? decision.trim().toUpperCase() : "PENDING";
        String decisionId = "REV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        EvidenceReviewDecision d = new EvidenceReviewDecision(
                decisionId,
                itemId,
                "NXS-007",
                safeDecision,
                notes != null ? notes : "",
                user,
                Instant.now().toString()
        );
        store.saveEvidenceReview(d);
        store.audit("EVIDENCE_REVIEW_DECISION", user, itemId, safeDecision);
        return d;
    }

    public List<EvidenceReviewDecision> listReviews(String caseId) {
        if (caseId != null && !caseId.isBlank()) {
            return store.evidenceReviewsByCase(caseId);
        }
        return store.evidenceReviews();
    }

    public Map<String, Object> promoteEntityToGraph(String itemId, String notes, String user) {
        EvidenceItem item = store.evidenceItem(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence item not found: " + itemId));
        EvidenceAsset asset = store.evidenceAsset(item.assetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent asset not found for item: " + itemId));

        if (investigationService == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "InvestigationService unavailable for promotion");
        }

        String entityType = item.provenance().path("entityType").asText("");
        String entityLabel = item.rawContent();
        String citation = item.provenance().path("citation").asText(item.rawContent());

        // Construct verified narrative entry for GraphBuilder
        ObjectNode recordNode = json.createObjectNode();
        recordNode.put("caseId", asset.caseId());
        recordNode.put("text", "CORROBORATED MULTIMODAL EVIDENCE: In " + asset.mediaType() + " asset (" + asset.fileName() + "), verified presence of " +
                (entityType.isBlank() ? "entity" : entityType) + " '" + entityLabel + "'. Context citation: \"" + citation + "\". Human determination: " +
                (notes != null && !notes.isBlank() ? notes : "Corroborated by investigator."));
        recordNode.put("date", Instant.now().toString());
        recordNode.put("sourceReliability", "A");
        recordNode.put("informationCredibility", "1");
        recordNode.put("crimeType", "Verified Lead");

        // Ingest into canonical GraphBuilder pipeline
        IngestResult ingestRes = investigationService.ingest("intel-report", new IngestRequest(List.of(recordNode), null, null));

        // Record human review decision as CORROBORATED
        EvidenceReviewDecision decision = recordReviewDecision(itemId, "CORROBORATED", notes != null ? notes : "Promoted to canonical graph", user);

        store.audit("EVIDENCE_PROMOTED_TO_GRAPH", user, itemId, entityLabel);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("promoted", true);
        res.put("itemId", itemId);
        res.put("entityLabel", entityLabel);
        res.put("entityType", entityType);
        res.put("caseId", asset.caseId());
        res.put("decision", decision);
        res.put("ingestResult", ingestRes);
        res.put("graph", investigationService.graph());
        return res;
    }

    public Map<String, Object> seedDemoMultimodalEvidence(String user) {
        // Seed 1: Scanned FIR Document (Case NXS-007)
        String firContent = (
                "MAHARASHTRA POLICE DEPARTMENT — FIRST INFORMATION REPORT (FIR No. 104/2026)\n" +
                "Police Station: Navapur · Case Reference: NXS-007\n" +
                "Complainant states that accused Aariv Veylan (alias Veyra) along with co-accused Dev Neral\n" +
                "operated an unauthorized remittance syndicate. Suspect utilized mobile number SYN-PHONE-001\n" +
                "(+919876543210) to authorize transfer of INR 75,000 into beneficiary bank account SYN-ACCOUNT-001.\n" +
                "Surveillance spotted silver getaway vehicle MH-04-AB-1234 departing incident scene at Navapur Sector 4.\n" +
                "Entities: Aariv Veylan, Dev Neral, SYN-PHONE-001, SYN-ACCOUNT-001, MH-04-AB-1234, Navapur Sector 4."
        );
        EvidenceAsset docAsset = uploadEvidence(
                firContent.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                "FIR_104_2026_Scanned.txt",
                "NXS-007",
                "DOCUMENT",
                "Scanned First Information Report detailing unauthorized remittance and getaway vehicle",
                user,
                true
        );

        // Seed 2: Intercepted Call Audio (Case NXS-007)
        byte[] callAudioSim = new byte[]{
            'R', 'I', 'F', 'F', 36, 0, 0, 0,
            'W', 'A', 'V', 'E',
            'f', 'm', 't', ' ', 16, 0, 0, 0, 1, 0, 1, 0, 0x44, (byte)0xac, 0, 0, (byte)0x88, 0x58, 1, 0, 2, 0, 16, 0,
            'd', 'a', 't', 'a', 0, 0, 0, 0
        };
        EvidenceAsset audioAsset = uploadEvidence(
                callAudioSim,
                "Intercepted_Call_NXS007.wav",
                "NXS-007",
                "AUDIO",
                "Intercepted voice recording between syndicate members regarding account transfers",
                user,
                true
        );

        // Seed 3: Cross-Case Seized Vehicle Photo (Target Case CASE-019)
        byte[] syntheticVehicleImg = createSyntheticImage(35, 75, 115);
        EvidenceAsset visualTarget = uploadEvidence(
                syntheticVehicleImg,
                "Seized_Vehicle_CASE019.jpg",
                "CASE-019",
                "IMAGE",
                "Dark silver sedan seized during Hawala raid in Case 019",
                user,
                true
        );

        // Seed 4: Probe Vehicle Image (Active Case NXS-007)
        byte[] syntheticProbeImg = createSyntheticImage(38, 78, 118);
        EvidenceAsset visualProbe = uploadEvidence(
                syntheticProbeImg,
                "CCTV_Vehicle_NXS007.jpg",
                "NXS-007",
                "IMAGE",
                "CCTV frame of vehicle MH-04-AB-1234 escaping Navapur Sector 4",
                user,
                true
        );

        // Seed 5: CCTV Video Footage (Active Case NXS-007)
        byte[] cctvBytes;
        try {
            java.nio.file.Path cctvFixturePath = java.nio.file.Paths.get("data/fixtures/cctv/synthetic_cctv_junction.mp4");
            if (java.nio.file.Files.exists(cctvFixturePath)) {
                cctvBytes = java.nio.file.Files.readAllBytes(cctvFixturePath);
            } else {
                cctvBytes = new byte[] { 0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm' };
            }
        } catch (Exception ex) {
            cctvBytes = new byte[] { 0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm' };
        }
        EvidenceAsset cctvAsset = uploadEvidence(
                cctvBytes,
                "CCTV_Junction_Cam04_NXS007.mp4",
                "NXS-007",
                "VIDEO",
                "Surveillance video from Navapur Junction Cam-04 covering vehicle transit and pedestrian corridor",
                user,
                false
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("seeded", true);
        res.put("documentAssetId", docAsset.id());
        res.put("audioAssetId", audioAsset.id());
        res.put("visualTargetAssetId", visualTarget.id());
        res.put("visualProbeAssetId", visualProbe.id());
        res.put("cctvAssetId", cctvAsset.id());
        res.put("message", "Multimodal evidence fixtures successfully seeded across NXS-007 and CASE-019");
        return res;
    }

    public Optional<EvidenceAsset> getAsset(String assetId) {
        return store.evidenceAsset(assetId);
    }

    public byte[] getAssetFileBytes(String assetId) {
        EvidenceAsset asset = store.evidenceAsset(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence asset not found: " + assetId));
        return readFileBytes(asset.storagePath());
    }

    private byte[] createSyntheticImage(int r, int g, int b) {
        try {
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(160, 120, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g2 = img.createGraphics();
            g2.setColor(new java.awt.Color(r, g, b));
            g2.fillRect(0, 0, 160, 120);
            g2.setColor(java.awt.Color.WHITE);
            g2.drawString("VEHICLE MH-04", 25, 60);
            g2.dispose();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            return new byte[]{ (byte)0xFF, (byte)0xD8, (byte)0xFF, (byte)0xE0, 0, 0 };
        }
    }

    public byte[] readFileBytes(String pathStr) {
        try {
            return Files.readAllBytes(Paths.get(pathStr));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Could not read stored evidence file");
        }
    }
}
