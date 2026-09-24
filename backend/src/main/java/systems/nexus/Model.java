package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

public final class Model {
    private Model() {}
    public record Node(String id, String type, String label, Map<String,Object> properties) {}
    public record Edge(String id, String source, String target, String type, Map<String,Object> properties) {}
    public record Evidence(String id, String recordId, String entityId, String edgeId,
                           Integer start, Integer end, Integer row, String raw, double confidence) {}
    public record Source(String id, String kind, JsonNode payload) {}
    public record Extracted(String type, String raw, int start, int end, double confidence,
                            String normalized, String role, String sourceRecordId) {}
    public record Extraction(List<Extracted> entities) {}
    public record Suggestion(String id, String left, String right, double score, String reason, String status) {}
    public record Graph(List<Node> nodes, List<Edge> edges, List<Evidence> evidence, List<Source> records,
                        JsonNode analysis, boolean analyzed, List<Suggestion> suggestions) {}
    public record IngestRequest(List<JsonNode> records, String format, String content) {}
    public record RowError(int row, String message) {}
    public record IngestResult(int accepted, int duplicates, List<RowError> errors) {}
    public record ReportRequest(
        String graphImage,
        List<String> sections,
        String simulationMode,
        WhatIfResponse whatIfData,
        EvidenceTrailResponse evidenceTrail
    ) {
        public ReportRequest(String graphImage) {
            this(graphImage, null, null, null, null);
        }
    }
    public record PathResult(List<String> nodeIds, List<Edge> edges) {}
    public record PersonFace(String id, String personNodeId, String imageHash, JsonNode embedding,
                             String modelName, String modelVersion, String createdAt,
                             String sourceRecordId, double qualityScore, JsonNode metadata) {}
    public record FaceDecision(String id, String personNodeId, String decision, double similarity,
                               String modelName, String imageHash, String notes, String author, String createdAt) {}
    public record FaceCandidate(String personNodeId, double similarity, String status, String model,
                                String faceId, Map<String,Object> person, Map<String,Object> quality) {}
    public record VisionSearchResult(String status, int facesDetected, double threshold, String model,
                                     String imageHash, List<FaceCandidate> matches,
                                     List<Map<String,Object>> faces, String alignedThumbnail) {}
    public record FaceDecisionRequest(String personNodeId, String decision, Double similarity,
                                      String imageHash, String modelName, String notes) {}

    // Investigation Intelligence Suite Models
    public record ReplayDelta(List<String> nodesAdded, List<String> edgesAdded, List<String> alertsTriggered) {}
    public record ReplayCumulative(int nodeCount, int edgeCount, int alertCount) {}
    public record ReplayStep(int step, String timestamp, String recordId, String kind, String caseId,
                              String summary, ReplayDelta delta, ReplayCumulative cumulative) {}
    public record ReplayResponse(List<ReplayStep> steps, int totalSteps, Graph graphAtStep) {}

    public record WhatIfRequest(List<String> excludeSources, List<String> excludeIdentifiers,
                                List<String> excludeDecisions, List<String> excludeNodes) {}
    public record WhatIfDelta(List<Node> removedNodes, List<Node> addedNodes,
                              List<Edge> removedEdges, List<Edge> addedEdges,
                              List<JsonNode> affectedAlerts, List<String> connectivityChanges) {}
    public record WhatIfResponse(boolean canonicalGraphUnchanged, int excludedCount,
                                 String summary, WhatIfDelta delta, Graph simulatedGraph) {}

    public record Contradiction(String id, String ruleId, String title, String severity,
                                String description, List<String> entityIds, List<String> evidenceIds,
                                List<String> sourceRecordIds, String reviewStatus, String reviewNotes,
                                String reviewedBy, String reviewedAt) {}
    public record ContradictionReview(String id, String ruleId, String status, String notes,
                                      String author, String updatedAt) {}
    public record ContradictionReviewRequest(String status, String notes) {}

    public record EvidenceDetail(String evidenceId, String sourceRecordId, String sourceKind,
                                 String caseId, String timestamp, double confidence,
                                 String rawExcerpt, String rationale) {}
    public record EvidenceTrailStep(Node sourceNode, Node targetNode, Edge edge, List<EvidenceDetail> evidence) {}
    public record EvidenceTrailPath(int pathIndex, int totalHops, List<EvidenceTrailStep> steps, String pathSummary) {}
    public record EvidenceTrailResponse(String fromNodeId, String toNodeId, String fromLabel, String toLabel,
                                        List<EvidenceTrailPath> paths, String chainSummary) {}

    public record InvestigationGap(String id, String category, String severity, String title,
                                  String description, List<String> entityIds, List<String> suggestedActions) {}
    public record GapsResponse(List<InvestigationGap> gaps, int totalGaps, Map<String, Integer> gapsByCategory) {}

    public record NetworkChange(String id, String timestamp, String trigger, String changeType,
                                String severity, String summary, List<String> affectedEntities,
                                String previousState, String newState) {}
    public record NetworkChangesResponse(List<NetworkChange> changes, int totalChanges, Map<String, Integer> changesByType) {}

    // Multimodal Evidence Fusion Records
    public record EvidenceAsset(String id, String caseId, String fileName, String mediaType, String mimeType,
                                 long fileSize, String fileHash, String storagePath, String status,
                                 String createdAt, String createdBy, JsonNode metadata) {}

    public record EvidenceItem(String id, String assetId, String itemType, int pageOrFrame,
                                double timestampStart, double timestampEnd, String speaker,
                                String rawContent, double confidence, JsonNode embedding,
                                String modelName, JsonNode provenance, String createdAt) {}

    public record EvidenceReviewDecision(String id, String itemId, String caseId, String decision,
                                         String notes, String author, String createdAt) {}

    public record EvidenceReviewRequest(String decision, String notes) {}

    public record VisualMatchLead(String matchAssetId, String matchCaseId, int matchFrameIndex,
                                  double matchTimestamp, double similarity, double similarityScore,
                                  String similarityDisplay, String leadDisclaimer, String thumbnail,
                                  JsonNode provenance) {}

    public record VisualSearchResponse(List<VisualMatchLead> matches, int count, double threshold, String leadNotice) {}
}
