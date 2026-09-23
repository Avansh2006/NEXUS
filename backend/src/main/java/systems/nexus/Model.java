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
    public record ReportRequest(String graphImage) {}
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
}
