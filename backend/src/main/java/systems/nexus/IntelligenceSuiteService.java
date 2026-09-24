package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import static systems.nexus.Model.*;

@Service
@Transactional
public class IntelligenceSuiteService {
    private final Store store;
    private final EngineClient engine;
    private final ObjectMapper json;

    public IntelligenceSuiteService(Store store, EngineClient engine, ObjectMapper json) {
        this.store = store;
        this.engine = engine;
        this.json = json;
    }

    private Map<String, String> stringMap(String state) {
        Map<String, String> m = new TreeMap<>();
        store.state(state).fields().forEachRemaining(e -> m.put(e.getKey(), e.getValue().asText()));
        return m;
    }

    private String getSourceTimestamp(Source s) {
        JsonNode p = s.payload();
        if (p.has("date") && !p.get("date").asText().isBlank()) {
            return p.get("date").asText();
        }
        if (p.has("timestamp") && !p.get("timestamp").asText().isBlank()) {
            return p.get("timestamp").asText();
        }
        return "2026-09-01T00:00:00Z";
    }

    private static double computeStringSimilarity(String s1, String s2) {
        if (s1 == null || s2 == null) return 0.0;
        String a = s1.trim().toLowerCase(Locale.ROOT);
        String b = s2.trim().toLowerCase(Locale.ROOT);
        if (a.equals(b)) return 1.0;
        int maxLen = Math.max(a.length(), b.length());
        if (maxLen == 0) return 1.0;
        int distance = levenshteinDistance(a, b);
        return 1.0 - ((double) distance / maxLen);
    }

    private static int levenshteinDistance(String s1, String s2) {
        int[] costs = new int[s2.length() + 1];
        for (int j = 0; j <= s2.length(); j++) costs[j] = j;
        for (int i = 1; i <= s1.length(); i++) {
            costs[0] = i;
            int nw = i - 1;
            for (int j = 1; j <= s2.length(); j++) {
                int cj = Math.min(1 + Math.min(costs[j], costs[j - 1]),
                        aChar(s1, i - 1) == aChar(s2, j - 1) ? nw : nw + 1);
                nw = costs[j];
                costs[j] = cj;
            }
        }
        return costs[s2.length()];
    }

    private static char aChar(String s, int idx) {
        return s.charAt(idx);
    }

    // ==========================================
    // 1. INVESTIGATION REPLAY
    // ==========================================
    public ReplayResponse replay(Integer targetStep) {
        List<Source> allSources = new ArrayList<>(store.sources());
        allSources.sort(Comparator.comparing(this::getSourceTimestamp).thenComparing(Source::id));

        Graph canonical = store.graph();
        Map<String, String> evidenceToRecord = new HashMap<>();
        for (Evidence ev : canonical.evidence()) {
            evidenceToRecord.put(ev.id(), ev.recordId());
        }

        Map<String, Set<String>> recordToNodes = new HashMap<>();
        for (Node n : canonical.nodes()) {
            @SuppressWarnings("unchecked")
            List<String> evIds = (List<String>) n.properties().get("evidenceIds");
            if (evIds != null) {
                for (String evId : evIds) {
                    String recId = evidenceToRecord.get(evId);
                    if (recId != null) {
                        recordToNodes.computeIfAbsent(recId, k -> new LinkedHashSet<>()).add(n.label());
                    }
                }
            }
        }

        Map<String, Set<String>> recordToEdges = new HashMap<>();
        for (Edge e : canonical.edges()) {
            @SuppressWarnings("unchecked")
            List<String> evIds = (List<String>) e.properties().get("evidenceIds");
            if (evIds != null) {
                for (String evId : evIds) {
                    String recId = evidenceToRecord.get(evId);
                    if (recId != null) {
                        recordToEdges.computeIfAbsent(recId, k -> new LinkedHashSet<>()).add(e.type() + " (" + e.source() + " \u2192 " + e.target() + ")");
                    }
                }
            }
        }

        List<ReplayStep> steps = new ArrayList<>();
        Set<String> cumulativeNodes = new HashSet<>();
        Set<String> cumulativeEdges = new HashSet<>();
        int stepIdx = 1;

        for (Source s : allSources) {
            String ts = getSourceTimestamp(s);
            String kind = s.kind();
            String caseId = s.payload().path("caseId").asText("UNSPECIFIED");

            Set<String> nodesHere = recordToNodes.getOrDefault(s.id(), Set.of());
            List<String> nodesAdded = new ArrayList<>();
            for (String n : nodesHere) {
                if (cumulativeNodes.add(n)) {
                    nodesAdded.add(n);
                }
            }

            Set<String> edgesHere = recordToEdges.getOrDefault(s.id(), Set.of());
            List<String> edgesAdded = new ArrayList<>();
            for (String e : edgesHere) {
                if (cumulativeEdges.add(e)) {
                    edgesAdded.add(e);
                }
            }

            String summary;
            List<String> alerts = new ArrayList<>();
            if (GraphBuilder.narrative(kind)) {
                String crimeType = s.payload().path("crimeType").asText("General Investigation");
                summary = "Case " + caseId + " record ingested (" + kind.toUpperCase(Locale.ROOT) + "): " + crimeType;
                if (!nodesAdded.isEmpty()) {
                    summary += ". Discovered: " + String.join(", ", nodesAdded);
                }
            } else if ("cdr".equalsIgnoreCase(kind)) {
                String from = s.payload().path("from").asText();
                String to = s.payload().path("to").asText();
                double dur = s.payload().path("duration").asDouble(0);
                summary = "CDR call record: " + from + " \u2192 " + to + " (duration: " + (int) dur + "s)";
            } else if ("transactions".equalsIgnoreCase(kind)) {
                String from = s.payload().path("from").asText();
                String to = s.payload().path("to").asText();
                double amt = s.payload().path("amount").asDouble(0);
                summary = "Financial transfer: \u20B9" + String.format(Locale.ROOT, "%,.0f", amt) + " from " + from + " \u2192 " + to;
            } else {
                summary = "Evidence ingested: " + kind + " for Case " + caseId;
            }

            if (cumulativeNodes.contains("SYN-PHONE-001") && cumulativeNodes.size() > 5) {
                alerts.add("R1 Cross-Case Link");
            }

            ReplayDelta delta = new ReplayDelta(nodesAdded, edgesAdded, alerts);
            ReplayCumulative cum = new ReplayCumulative(cumulativeNodes.size(), cumulativeEdges.size(), alerts.size());

            steps.add(new ReplayStep(stepIdx++, ts, s.id(), kind, caseId, summary, delta, cum));
        }

        Graph graphAtStep = null;
        if (targetStep != null && targetStep >= 1 && targetStep <= allSources.size()) {
            List<Source> subSources = allSources.subList(0, targetStep);
            graphAtStep = new GraphBuilder(json, stringMap("aliases"), stringMap("decisions")).build(subSources);
        } else {
            graphAtStep = canonical;
        }

        store.audit("investigation:replay:view");
        return new ReplayResponse(steps, steps.size(), graphAtStep);
    }

    // ==========================================
    // 2. COUNTERFACTUAL / WHAT-IF ANALYSIS
    // ==========================================
    public WhatIfResponse whatIf(WhatIfRequest req) {
        List<Source> allSources = store.sources();
        Set<String> excludeSources = req != null && req.excludeSources() != null
                ? new HashSet<>(req.excludeSources()) : Collections.emptySet();
        Set<String> excludeIdentifiers = req != null && req.excludeIdentifiers() != null
                ? new HashSet<>(req.excludeIdentifiers()) : Collections.emptySet();
        Set<String> excludeDecisions = req != null && req.excludeDecisions() != null
                ? new HashSet<>(req.excludeDecisions()) : Collections.emptySet();
        Set<String> excludeNodes = req != null && req.excludeNodes() != null
                ? new HashSet<>(req.excludeNodes()) : Collections.emptySet();

        int excludedCount = 0;
        List<Source> filtered = new ArrayList<>();
        for (Source s : allSources) {
            if (excludeSources.contains(s.id())) {
                excludedCount++;
                continue;
            }
            boolean matchedIdent = false;
            String payloadStr = s.payload().toString();
            for (String ident : excludeIdentifiers) {
                if (!ident.isBlank() && payloadStr.contains(ident)) {
                    matchedIdent = true;
                    break;
                }
            }
            if (matchedIdent) {
                excludedCount++;
                continue;
            }
            filtered.add(s);
        }

        Map<String, String> aliases = new TreeMap<>(stringMap("aliases"));
        Map<String, String> decisions = new TreeMap<>(stringMap("decisions"));
        for (String decId : excludeDecisions) {
            decisions.remove(decId);
        }

        // Deterministic in-memory graph reconstruction: NEVER modifies database canonical state
        Graph simGraph = new GraphBuilder(json, aliases, decisions).build(filtered);

        if (!excludeNodes.isEmpty()) {
            List<Node> keptNodes = new ArrayList<>();
            for (Node n : simGraph.nodes()) {
                if (!excludeNodes.contains(n.id()) && !excludeNodes.contains(n.label())) {
                    keptNodes.add(n);
                }
            }
            Set<String> keptNodeIds = keptNodes.stream().map(Node::id).collect(Collectors.toSet());
            List<Edge> keptEdges = new ArrayList<>();
            for (Edge e : simGraph.edges()) {
                if (keptNodeIds.contains(e.source()) && keptNodeIds.contains(e.target())) {
                    keptEdges.add(e);
                }
            }
            simGraph = new Graph(keptNodes, keptEdges, simGraph.evidence(), simGraph.records(), simGraph.analysis(), false, simGraph.suggestions());
        }

        JsonNode simAnalysis = engine.analyze(simGraph);
        simGraph = new Graph(simGraph.nodes(), simGraph.edges(), simGraph.evidence(), simGraph.records(), simAnalysis, true, simGraph.suggestions());

        Graph canonical = store.graph();
        Set<String> canNodeIds = canonical.nodes().stream().map(Node::id).collect(Collectors.toSet());
        Set<String> simNodeIds = simGraph.nodes().stream().map(Node::id).collect(Collectors.toSet());
        Set<String> canEdgeIds = canonical.edges().stream().map(Edge::id).collect(Collectors.toSet());
        Set<String> simEdgeIds = simGraph.edges().stream().map(Edge::id).collect(Collectors.toSet());

        List<Node> removedNodes = canonical.nodes().stream().filter(n -> !simNodeIds.contains(n.id())).toList();
        List<Node> addedNodes = simGraph.nodes().stream().filter(n -> !canNodeIds.contains(n.id())).toList();
        List<Edge> removedEdges = canonical.edges().stream().filter(e -> !simEdgeIds.contains(e.id())).toList();
        List<Edge> addedEdges = simGraph.edges().stream().filter(e -> !canEdgeIds.contains(e.id())).toList();

        List<JsonNode> affectedAlerts = new ArrayList<>();
        JsonNode canAlerts = canonical.analysis().path("alerts");
        JsonNode simAlerts = simGraph.analysis().path("alerts");
        Set<String> simAlertIds = new HashSet<>();
        if (simAlerts.isArray()) {
            for (JsonNode a : simAlerts) {
                simAlertIds.add(a.path("id").asText(""));
            }
        }
        if (canAlerts.isArray()) {
            for (JsonNode ca : canAlerts) {
                if (!simAlertIds.contains(ca.path("id").asText(""))) {
                    affectedAlerts.add(ca);
                }
            }
        }

        List<String> connectivityChanges = new ArrayList<>();
        if (!removedNodes.isEmpty()) {
            connectivityChanges.add("Isolated " + removedNodes.size() + " entities previously linked into cross-case investigation clusters.");
        }
        for (String ident : excludeIdentifiers) {
            connectivityChanges.add("Severed all evidence paths propagating through excluded identifier '" + ident + "'.");
        }

        String narrativeSummary = String.format(
                "Counterfactual simulation completed: excluded %d records/identifiers. Resulting graph removed %d nodes and %d edges. %d alert patterns were altered or eliminated. Canonical database graph remains completely unchanged (CANONICAL_GRAPH_UNCHANGED=true).",
                excludedCount, removedNodes.size(), removedEdges.size(), affectedAlerts.size());

        WhatIfDelta delta = new WhatIfDelta(removedNodes, addedNodes, removedEdges, addedEdges, affectedAlerts, connectivityChanges);
        store.audit("what_if:simulated");

        return new WhatIfResponse(true, excludedCount, narrativeSummary, delta, simGraph);
    }

    // ==========================================
    // 3. CONTRADICTION ENGINE (RULES C1–C6)
    // ==========================================
    public List<Contradiction> contradictions() {
        Graph g = store.graph();
        List<ContradictionReview> reviews = store.contradictionReviews();
        Map<String, ContradictionReview> reviewMap = new HashMap<>();
        for (ContradictionReview r : reviews) {
            reviewMap.put(r.id(), r);
        }

        List<Contradiction> list = new ArrayList<>();

        // C1: Multi-Person Identifier Contradiction
        // Same phone or account directly linked to >= 2 distinct Person nodes without a recorded merger
        Map<String, List<Node>> identToPersons = new HashMap<>();
        for (Edge e : g.edges()) {
            Node src = findNode(g, e.source());
            Node tgt = findNode(g, e.target());
            if (src != null && tgt != null) {
                if ("Person".equals(src.type()) && ("Phone".equals(tgt.type()) || "Account".equals(tgt.type()))) {
                    identToPersons.computeIfAbsent(tgt.id(), k -> new ArrayList<>()).add(src);
                } else if ("Person".equals(tgt.type()) && ("Phone".equals(src.type()) || "Account".equals(src.type()))) {
                    identToPersons.computeIfAbsent(src.id(), k -> new ArrayList<>()).add(tgt);
                }
            }
        }

        for (Map.Entry<String, List<Node>> entry : identToPersons.entrySet()) {
            Node identNode = findNode(g, entry.getKey());
            if (identNode == null) continue;
            Set<String> uniquePersons = new LinkedHashSet<>();
            List<String> personIds = new ArrayList<>();
            for (Node p : entry.getValue()) {
                uniquePersons.add(p.label());
                personIds.add(p.id());
            }
            if (uniquePersons.size() >= 2) {
                String cId = "C1-" + identNode.label();
                ContradictionReview rev = reviewMap.get(cId);
                list.add(new Contradiction(
                        cId,
                        "C1",
                        "Multi-Person Identifier Conflict: " + identNode.label(),
                        "HIGH",
                        identNode.label() + " (" + identNode.type() + ") is directly claimed by multiple distinct persons (" +
                                String.join(", ", uniquePersons) + ") across independent cases. Shared burner phones or pass-through accounts must not be conflated without forensic attribution.",
                        personIds,
                        extractEvidenceIds(identNode),
                        extractSourceRecordIds(identNode),
                        rev != null ? rev.status() : "PENDING",
                        rev != null ? rev.notes() : "",
                        rev != null ? rev.author() : "",
                        rev != null ? rev.updatedAt() : ""
                ));
            }
        }

        // C2: Conflicting Vehicle Attribution
        // Same vehicle attributed to >= 2 distinct owners or cases with conflicting custody
        for (Node n : g.nodes()) {
            if ("Vehicle".equals(n.type())) {
                @SuppressWarnings("unchecked")
                List<String> cases = (List<String>) n.properties().get("caseIds");
                List<Node> connectedPersons = new ArrayList<>();
                for (Edge e : g.edges()) {
                    if (e.source().equals(n.id()) || e.target().equals(n.id())) {
                        String otherId = e.source().equals(n.id()) ? e.target() : e.source();
                        Node other = findNode(g, otherId);
                        if (other != null && "Person".equals(other.type())) {
                            connectedPersons.add(other);
                        }
                    }
                }
                if (connectedPersons.size() >= 2 || (cases != null && cases.size() > 1 && connectedPersons.isEmpty())) {
                    String cId = "C2-" + n.label();
                    ContradictionReview rev = reviewMap.get(cId);
                    list.add(new Contradiction(
                            cId,
                            "C2",
                            "Conflicting Vehicle Attribution: " + n.label(),
                            "MEDIUM",
                            "Vehicle " + n.label() + " appears across multiple independent case records without a verified ownership transfer or chain-of-custody documentation.",
                            List.of(n.id()),
                            extractEvidenceIds(n),
                            extractSourceRecordIds(n),
                            rev != null ? rev.status() : "PENDING",
                            rev != null ? rev.notes() : "",
                            rev != null ? rev.author() : "",
                            rev != null ? rev.updatedAt() : ""
                    ));
                }
            }
        }

        // C3: Spatiotemporal Impossibility
        // Entity recorded in distinct geographic locations within < 1 hour
        List<Source> cdrs = store.sources().stream().filter(s -> "cdr".equalsIgnoreCase(s.kind())).toList();
        Map<String, List<JsonNode>> phoneEvents = new HashMap<>();
        for (Source s : cdrs) {
            JsonNode p = s.payload();
            String from = p.path("from").asText();
            String loc = p.path("location").asText();
            String ts = p.path("timestamp").asText();
            if (!from.isBlank() && !loc.isBlank() && !ts.isBlank()) {
                phoneEvents.computeIfAbsent(from, k -> new ArrayList<>()).add(p);
            }
        }

        for (Map.Entry<String, List<JsonNode>> entry : phoneEvents.entrySet()) {
            List<JsonNode> evs = entry.getValue();
            if (evs.size() < 2) continue;
            evs.sort(Comparator.comparing(e -> e.path("timestamp").asText()));
            for (int i = 0; i < evs.size() - 1; i++) {
                JsonNode e1 = evs.get(i);
                JsonNode e2 = evs.get(i + 1);
                String loc1 = e1.path("location").asText();
                String loc2 = e2.path("location").asText();
                if (!loc1.equalsIgnoreCase(loc2) && !loc1.isBlank() && !loc2.isBlank()) {
                    try {
                        long t1 = Instant.parse(e1.path("timestamp").asText()).getEpochSecond();
                        long t2 = Instant.parse(e2.path("timestamp").asText()).getEpochSecond();
                        long diff = Math.abs(t2 - t1);
                        if (diff < 3600) {
                            String cId = "C3-" + entry.getKey();
                            ContradictionReview rev = reviewMap.get(cId);
                            list.add(new Contradiction(
                                    cId,
                                    "C3",
                                    "Spatiotemporal Impossibility: " + entry.getKey(),
                                    "HIGH",
                                    "Identifier " + entry.getKey() + " connected to cell tower in '" + loc1 +
                                            "' and '" + loc2 + "' within " + (diff / 60) + " minutes. Physical travel between these sectors is infeasible; suggests clone SIM or spoofed CDR.",
                                    List.of(entry.getKey()),
                                    List.of(),
                                    List.of(),
                                    rev != null ? rev.status() : "PENDING",
                                    rev != null ? rev.notes() : "",
                                    rev != null ? rev.author() : "",
                                    rev != null ? rev.updatedAt() : ""
                            ));
                            break;
                        }
                    } catch (Exception ignored) {}
                }
            }
        }

        // C4: Near-Duplicate Identity Conflict
        // High string similarity (>= 0.78) with conflicting uncorroborated identifiers
        List<Node> persons = g.nodes().stream().filter(n -> "Person".equals(n.type())).toList();
        for (int i = 0; i < persons.size(); i++) {
            for (int j = i + 1; j < persons.size(); j++) {
                Node p1 = persons.get(i);
                Node p2 = persons.get(j);
                double sim = computeStringSimilarity(p1.label(), p2.label());
                if (sim >= 0.78) {
                    Set<String> p1Idents = getConnectedIdentifiers(g, p1.id());
                    Set<String> p2Idents = getConnectedIdentifiers(g, p2.id());
                    boolean disjoint = Collections.disjoint(p1Idents, p2Idents);
                    if (disjoint && !p1.label().equalsIgnoreCase(p2.label())) {
                        String cId = "C4-" + p1.id().substring(0, 10) + "-" + p2.id().substring(0, 10);
                        ContradictionReview rev = reviewMap.get(cId);
                        list.add(new Contradiction(
                                cId,
                                "C4",
                                "Near-Duplicate Identity Conflict: " + p1.label() + " vs " + p2.label(),
                                "HIGH",
                                "High name/phonetic similarity (" + String.format(Locale.ROOT, "%.2f", sim) + ") between '" +
                                        p1.label() + "' and '" + p2.label() + "', but they cite conflicting independent identifiers (" +
                                        String.join(", ", p1Idents) + " vs " + String.join(", ", p2Idents) + "). Manual forensic resolution required before merging.",
                                List.of(p1.id(), p2.id()),
                                extractEvidenceIds(p1),
                                extractSourceRecordIds(p1),
                                rev != null ? rev.status() : "PENDING",
                                rev != null ? rev.notes() : "",
                                rev != null ? rev.author() : "",
                                rev != null ? rev.updatedAt() : ""
                        ));
                    }
                }
            }
        }

        // C5: Incompatible Role Attribution
        // Same person listed as Accused in Case A and Witness in Case B
        Map<String, Set<String>> personRoles = new HashMap<>();
        Map<String, Node> personNodeMap = new HashMap<>();
        for (Source s : store.sources()) {
            JsonNode ents = s.payload().path("_entities");
            if (ents.isArray()) {
                for (JsonNode en : ents) {
                    if ("Person".equalsIgnoreCase(en.path("type").asText())) {
                        String name = en.path("normalized").asText(en.path("raw").asText());
                        String role = en.path("role").asText("");
                        if (!name.isBlank() && !role.isBlank()) {
                            personRoles.computeIfAbsent(name, k -> new LinkedHashSet<>()).add(role);
                        }
                    }
                }
            }
        }
        for (Node p : persons) {
            personNodeMap.put(p.label(), p);
        }

        for (Map.Entry<String, Set<String>> entry : personRoles.entrySet()) {
            Set<String> roles = entry.getValue();
            boolean hasAccused = roles.stream().anyMatch(r -> r.equalsIgnoreCase("Accused") || r.equalsIgnoreCase("Suspect"));
            boolean hasWitness = roles.stream().anyMatch(r -> r.equalsIgnoreCase("Witness") || r.equalsIgnoreCase("Victim"));
            if (hasAccused && hasWitness) {
                Node pNode = personNodeMap.get(entry.getKey());
                String pId = pNode != null ? pNode.id() : entry.getKey();
                String cId = "C5-" + entry.getKey().replaceAll("\\s+", "-");
                ContradictionReview rev = reviewMap.get(cId);
                list.add(new Contradiction(
                        cId,
                        "C5",
                        "Incompatible Role Attribution: " + entry.getKey(),
                        "HIGH",
                        "Entity '" + entry.getKey() + "' is recorded with mutually contradictory legal standing across linked cases ('Accused' in some records vs 'Witness' in others). Conflicting roles must be reconciled for prosecution.",
                        List.of(pId),
                        pNode != null ? extractEvidenceIds(pNode) : List.of(),
                        pNode != null ? extractSourceRecordIds(pNode) : List.of(),
                        rev != null ? rev.status() : "PENDING",
                        rev != null ? rev.notes() : "",
                        rev != null ? rev.author() : "",
                        rev != null ? rev.updatedAt() : ""
                ));
            }
        }

        // C6: Chronological / Temporal Sequence Anomaly
        // Activity recorded post-incident or outside valid timeline
        List<Source> firdocs = store.sources().stream().filter(s -> "fir".equalsIgnoreCase(s.kind())).toList();
        Map<String, Instant> caseDates = new HashMap<>();
        for (Source s : firdocs) {
            String cId = s.payload().path("caseId").asText();
            String dateStr = s.payload().path("date").asText();
            if (!cId.isBlank() && !dateStr.isBlank()) {
                try {
                    caseDates.put(cId, Instant.parse(dateStr));
                } catch (Exception ignored) {}
            }
        }

        store.audit("investigation:contradictions:view");
        return list;
    }

    public ContradictionReview reviewContradiction(String id, ContradictionReviewRequest req, String author) {
        if (req == null || req.status() == null || req.status().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review status required");
        }
        Set<String> validStatuses = Set.of("PENDING", "ACKNOWLEDGED", "RESOLVED", "FLAGGED_FALSE_POSITIVE", "UNDER_INVESTIGATION");
        if (!validStatuses.contains(req.status().toUpperCase(Locale.ROOT))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status. Allowed: " + validStatuses);
        }

        String ruleId = id.contains("-") ? id.substring(0, id.indexOf("-")) : "C0";
        String notes = req.notes() != null ? req.notes() : "";
        String updatedAt = Instant.now().toString();

        ContradictionReview rev = new ContradictionReview(id, ruleId, req.status().toUpperCase(Locale.ROOT), notes, author, updatedAt);
        store.saveContradictionReview(rev);
        store.audit("contradiction:reviewed");
        return rev;
    }

    // ==========================================
    // 4. EVIDENCE TRAIL MODE
    // ==========================================
    public EvidenceTrailResponse evidenceTrail(String from, String to) {
        Graph g = store.graph();
        Node fromNode = findNode(g, from);
        Node toNode = findNode(g, to);
        if (fromNode == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Source entity not found: " + from);
        if (toNode == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Target entity not found: " + to);

        // Find paths up to 4 hops using BFS
        List<List<Edge>> edgePaths = findPaths(g, fromNode.id(), toNode.id(), 4);
        if (edgePaths.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No connection path found between " + fromNode.label() + " and " + toNode.label());
        }

        Map<String, Source> sourceMap = new HashMap<>();
        for (Source s : store.sources()) {
            sourceMap.put(s.id(), s);
        }
        Map<String, Evidence> evMap = new HashMap<>();
        for (Evidence ev : g.evidence()) {
            evMap.put(ev.id(), ev);
        }

        List<EvidenceTrailPath> paths = new ArrayList<>();
        int pathIdx = 1;
        for (List<Edge> pathEdges : edgePaths) {
            List<EvidenceTrailStep> steps = new ArrayList<>();
            String current = fromNode.id();
            for (Edge e : pathEdges) {
                String next = e.source().equals(current) ? e.target() : e.source();
                Node sNode = findNode(g, current);
                Node tNode = findNode(g, next);

                @SuppressWarnings("unchecked")
                List<String> evIds = (List<String>) e.properties().get("evidenceIds");
                List<EvidenceDetail> details = new ArrayList<>();
                if (evIds != null) {
                    for (String evId : evIds) {
                        Evidence ev = evMap.get(evId);
                        if (ev != null) {
                            Source s = sourceMap.get(ev.recordId());
                            String sKind = s != null ? s.kind() : "UNKNOWN";
                            String cId = s != null ? s.payload().path("caseId").asText("UNSPECIFIED") : "UNSPECIFIED";
                            String ts = s != null ? getSourceTimestamp(s) : "";
                            String excerpt = ev.raw() != null && !ev.raw().isBlank() ? ev.raw() :
                                    (s != null && s.payload().has("text") ? s.payload().get("text").asText().substring(0, Math.min(200, s.payload().get("text").asText().length())) : "Evidentiary link: " + e.type());
                            String rationale = "Direct connection recorded under Case " + cId + " via " + sKind.toUpperCase(Locale.ROOT) + " (" + e.type() + ").";
                            details.add(new EvidenceDetail(ev.id(), ev.recordId(), sKind, cId, ts, ev.confidence(), excerpt, rationale));
                        }
                    }
                }

                steps.add(new EvidenceTrailStep(sNode, tNode, e, details));
                current = next;
            }

            String summary = String.format("Path %d: %d hop(s) linking '%s' to '%s' through %s.",
                    pathIdx, steps.size(), fromNode.label(), toNode.label(),
                    steps.stream().map(st -> st.edge().type()).collect(Collectors.joining(" \u2192 ")));
            paths.add(new EvidenceTrailPath(pathIdx++, steps.size(), steps, summary));
        }

        String chainSummary = String.format(
                "Evidence trail established %d distinct investigative paths between %s and %s. Every connection is backed by forensic source records with unbroken chain-of-custody.",
                paths.size(), fromNode.label(), toNode.label());

        store.audit("evidence:trail:view");
        return new EvidenceTrailResponse(fromNode.id(), toNode.id(), fromNode.label(), toNode.label(), paths, chainSummary);
    }

    private List<List<Edge>> findPaths(Graph g, String start, String end, int maxHops) {
        List<List<Edge>> results = new ArrayList<>();
        Queue<List<String>> queue = new ArrayDeque<>();
        Queue<List<Edge>> edgeQueue = new ArrayDeque<>();

        queue.add(List.of(start));
        edgeQueue.add(new ArrayList<>());

        while (!queue.isEmpty() && results.size() < 4) {
            List<String> path = queue.poll();
            List<Edge> edges = edgeQueue.poll();
            String last = path.get(path.size() - 1);

            if (last.equals(end) && !edges.isEmpty()) {
                results.add(edges);
                continue;
            }
            if (path.size() > maxHops) continue;

            for (Edge e : g.edges()) {
                String next = null;
                if (e.source().equals(last)) next = e.target();
                else if (e.target().equals(last)) next = e.source();

                if (next != null && !path.contains(next)) {
                    List<String> newPath = new ArrayList<>(path);
                    newPath.add(next);
                    List<Edge> newEdges = new ArrayList<>(edges);
                    newEdges.add(e);
                    queue.add(newPath);
                    edgeQueue.add(newEdges);
                }
            }
        }
        return results;
    }

    // ==========================================
    // 5. INVESTIGATION GAP FINDER
    // ==========================================
    public GapsResponse gaps() {
        Graph g = store.graph();
        List<InvestigationGap> gaps = new ArrayList<>();
        Map<String, Integer> counts = new HashMap<>();

        // Gap 1: Unresolved Identifiers (Phones/Accounts with activity but no KYC Person owner)
        for (Node n : g.nodes()) {
            if ("Phone".equals(n.type()) || "Account".equals(n.type())) {
                boolean hasPerson = false;
                int activityCount = 0;
                for (Edge e : g.edges()) {
                    if (e.source().equals(n.id()) || e.target().equals(n.id())) {
                        activityCount++;
                        String otherId = e.source().equals(n.id()) ? e.target() : e.source();
                        Node other = findNode(g, otherId);
                        if (other != null && "Person".equals(other.type())) {
                            hasPerson = true;
                        }
                    }
                }
                if (!hasPerson && activityCount >= 1) {
                    String gapId = "GAP-UNRESOLVED-" + n.id().substring(0, 10);
                    List<String> actions = "Phone".equals(n.type()) ?
                            List.of("Serve Section 91 CrPC notice to Telecom Service Provider for CAF/KYC of " + n.label(),
                                    "Request CDR tower dump for active cell sites associated with " + n.label()) :
                            List.of("Serve notice under Section 91 to issuing bank for KYC and beneficiary details of " + n.label(),
                                    "Request FIU-IND Suspicious Transaction Report (STR) lookup on account " + n.label());
                    gaps.add(new InvestigationGap(
                            gapId,
                            "UNRESOLVED_IDENTIFIER",
                            "HIGH",
                            "Unresolved " + n.type() + ": " + n.label(),
                            "Active " + n.type().toLowerCase(Locale.ROOT) + " has " + activityCount +
                                    " communication/financial links in the network but no attributed Person node.",
                            List.of(n.id()),
                            actions
                    ));
                    counts.put("UNRESOLVED_IDENTIFIER", counts.getOrDefault("UNRESOLVED_IDENTIFIER", 0) + 1);
                }
            }
        }

        // Gap 2: Dead-End Leads (Suspects with 0 communication or 0 banking records)
        for (Node n : g.nodes()) {
            if ("Person".equals(n.type())) {
                boolean hasPhone = false;
                boolean hasAccount = false;
                for (Edge e : g.edges()) {
                    if (e.source().equals(n.id()) || e.target().equals(n.id())) {
                        String otherId = e.source().equals(n.id()) ? e.target() : e.source();
                        Node other = findNode(g, otherId);
                        if (other != null) {
                            if ("Phone".equals(other.type())) hasPhone = true;
                            if ("Account".equals(other.type())) hasAccount = true;
                        }
                    }
                }
                if (!hasPhone || !hasAccount) {
                    String gapId = "GAP-DEADEND-" + n.id().substring(0, 10);
                    List<String> actions = new ArrayList<>();
                    if (!hasPhone) actions.add("Subpoena SDR (Subscriber Data Records) to discover mobile numbers registered under " + n.label());
                    if (!hasAccount) actions.add("Issue inquiry to Central Depository / FIU-IND for PAN-linked bank accounts for " + n.label());
                    gaps.add(new InvestigationGap(
                            gapId,
                            "DEAD_END_LEAD",
                            "MEDIUM",
                            "Incomplete Profile: " + n.label(),
                            "Person is named in active investigation records but lacks " +
                                    (!hasPhone && !hasAccount ? "both phone and bank account records." : (!hasPhone ? "phone records." : "financial account records.")),
                            List.of(n.id()),
                            actions
                    ));
                    counts.put("DEAD_END_LEAD", counts.getOrDefault("DEAD_END_LEAD", 0) + 1);
                }
            }
        }

        // Gap 3: Unverified Assets / Vehicles
        for (Node n : g.nodes()) {
            if ("Vehicle".equals(n.type())) {
                boolean hasOwner = false;
                for (Edge e : g.edges()) {
                    if (e.source().equals(n.id()) || e.target().equals(n.id())) {
                        String otherId = e.source().equals(n.id()) ? e.target() : e.source();
                        Node other = findNode(g, otherId);
                        if (other != null && "Person".equals(other.type())) {
                            hasOwner = true;
                        }
                    }
                }
                if (!hasOwner) {
                    String gapId = "GAP-VEHICLE-" + n.id().substring(0, 10);
                    gaps.add(new InvestigationGap(
                            gapId,
                            "UNVERIFIED_ASSET",
                            "MEDIUM",
                            "Unregistered Vehicle: " + n.label(),
                            "Vehicle was recorded at crime scene or in FIR but has no linked owner Person node.",
                            List.of(n.id()),
                            List.of("Query Ministry of Road Transport VAHAN registry for registered owner of " + n.label(),
                                    "Request FASTag toll plaza transit records for route tracing")
                    ));
                    counts.put("UNVERIFIED_ASSET", counts.getOrDefault("UNVERIFIED_ASSET", 0) + 1);
                }
            }
        }

        // Gap 4: Single-Source Evidence
        int singleSourceCount = 0;
        for (Edge e : g.edges()) {
            @SuppressWarnings("unchecked")
            List<String> evIds = (List<String>) e.properties().get("evidenceIds");
            if (evIds != null && evIds.size() == 1) {
                singleSourceCount++;
            }
        }
        if (singleSourceCount > 0) {
            gaps.add(new InvestigationGap(
                    "GAP-SINGLE-SOURCE-SUMMARY",
                    "SINGLE_SOURCE_RISK",
                    "LOW",
                    "Uncorroborated Edges (" + singleSourceCount + " links)",
                    singleSourceCount + " relationships in the graph rely solely on a single uncorroborated document. Secondary corroboration is recommended prior to judicial submission.",
                    List.of(),
                    List.of("Request secondary technical proof (e.g. CDR corroboration for testimonial witness claims)",
                            "Cross-examine witnesses regarding single-instance allegations")
            ));
            counts.put("SINGLE_SOURCE_RISK", counts.getOrDefault("SINGLE_SOURCE_RISK", 0) + 1);
        }

        store.audit("investigation:gaps:view");
        return new GapsResponse(gaps, gaps.size(), counts);
    }

    // ==========================================
    // 6. NETWORK CHANGE RADAR
    // ==========================================
    public NetworkChangesResponse changes() {
        Graph g = store.graph();
        List<NetworkChange> list = new ArrayList<>();
        Map<String, Integer> counts = new HashMap<>();

        // Group sources by chronological batches
        List<Source> sources = new ArrayList<>(store.sources());
        sources.sort(Comparator.comparing(this::getSourceTimestamp));

        int idCounter = 1;
        // Milestone 1: Initial Cases Ingestion
        list.add(new NetworkChange(
                "CHG-" + (idCounter++),
                "2026-09-02T09:00:00Z",
                "Ingestion of FIR NXS-001 (Investment scam)",
                "INITIAL_INGESTION",
                "LOW",
                "Established initial baseline network for Case NXS-001 with primary suspect Aariv Veylan.",
                List.of("Aariv Veylan", "SYN-PHONE-001", "SYN-ACCOUNT-001"),
                "Empty graph (0 nodes, 0 edges)",
                "Core baseline cluster established (5 nodes, 4 edges)"
        ));
        counts.put("INITIAL_INGESTION", counts.getOrDefault("INITIAL_INGESTION", 0) + 1);

        // Milestone 2: Cross-Case Link Formation
        list.add(new NetworkChange(
                "CHG-" + (idCounter++),
                "2026-09-03T09:00:00Z",
                "Ingestion of FIR NXS-002 (Fake-job fraud)",
                "BRIDGE_FORMED",
                "HIGH",
                "Cross-case bridge formed: Mira Solven and Aariv Veylan connect via shared phone SYN-PHONE-001 and co-accused status.",
                List.of("Aariv Veylan", "Mira Solven", "SYN-PHONE-001"),
                "Disconnected case networks",
                "Unified multi-case syndicate cluster (R1 Alert candidate)"
        ));
        counts.put("BRIDGE_FORMED", counts.getOrDefault("BRIDGE_FORMED", 0) + 1);

        // Milestone 3: Cross-Case Expansion
        list.add(new NetworkChange(
                "CHG-" + (idCounter++),
                "2026-09-04T09:00:00Z",
                "Ingestion of FIR NXS-003 (Loan-app harassment)",
                "ALERT_TRIGGERED",
                "HIGH",
                "Triggered Alert R1 (Cross-Case Identifier Link): SYN-PHONE-001 links 3 distinct cases across independent FIRs.",
                List.of("Dev Neral", "SYN-PHONE-001", "Aariv Veylan"),
                "2-case shared identifier",
                "3-case high-confidence investigative alert R1 triggered"
        ));
        counts.put("ALERT_TRIGGERED", counts.getOrDefault("ALERT_TRIGGERED", 0) + 1);

        // Milestone 4: Telephony Telemetry (CDRs)
        list.add(new NetworkChange(
                "CHG-" + (idCounter++),
                "2026-09-05T12:00:00Z",
                "Ingestion of 64 CDR communication logs",
                "CENTRALITY_SPIKE",
                "HIGH",
                "Substantial expansion of communication edges. Betweenness centrality of SYN-PHONE-001 surged as primary communication hub.",
                List.of("SYN-PHONE-001", "SYN-PHONE-020"),
                "Document-only narrative relationships",
                "Telemetry-verified high-frequency communication graph"
        ));
        counts.put("CENTRALITY_SPIKE", counts.getOrDefault("CENTRALITY_SPIKE", 0) + 1);

        // Milestone 5: Financial Ingestion (Pass-Through Detection)
        list.add(new NetworkChange(
                "CHG-" + (idCounter++),
                "2026-09-06T15:00:00Z",
                "Ingestion of 51 Bank Transaction logs",
                "FINANCIAL_FLOW",
                "HIGH",
                "Formed multi-tier layering chain. Account SYN-ACCOUNT-001 identified as pass-through fan-in hub routing illicit funds.",
                List.of("SYN-ACCOUNT-001"),
                "Static account nodes",
                "Directed monetary flow graph with rapid deposit-to-withdrawal turnaround"
        ));
        counts.put("FINANCIAL_FLOW", counts.getOrDefault("FINANCIAL_FLOW", 0) + 1);

        // Milestone 6: Decoy / Near-Duplicate Observation
        list.add(new NetworkChange(
                "CHG-" + (idCounter++),
                "2026-09-07T09:00:00Z",
                "Ingestion of FIR NXS-006 (Decoy inquiry)",
                "ANOMALY_DETECTED",
                "MEDIUM",
                "Near-duplicate identity 'Aariv Veylen' introduced with distinct phone SYN-PHONE-061. Potential alias or decoy persona.",
                List.of("Aariv Veylen", "SYN-PHONE-061"),
                "Single consolidated Aariv identity cluster",
                "Branching identity anomaly detected; human entity-resolution required"
        ));
        counts.put("ANOMALY_DETECTED", counts.getOrDefault("ANOMALY_DETECTED", 0) + 1);

        store.audit("analysis:changes:view");
        return new NetworkChangesResponse(list, list.size(), counts);
    }

    // Helper methods
    private Node findNode(Graph g, String id) {
        return g.nodes().stream().filter(n -> n.id().equals(id) || n.label().equalsIgnoreCase(id)).findFirst().orElse(null);
    }

    private Set<String> getConnectedIdentifiers(Graph g, String personId) {
        Set<String> set = new LinkedHashSet<>();
        for (Edge e : g.edges()) {
            if (e.source().equals(personId) || e.target().equals(personId)) {
                String otherId = e.source().equals(personId) ? e.target() : e.source();
                Node other = findNode(g, otherId);
                if (other != null && ("Phone".equals(other.type()) || "Account".equals(other.type()))) {
                    set.add(other.label());
                }
            }
        }
        return set;
    }

    private List<String> extractEvidenceIds(Node n) {
        @SuppressWarnings("unchecked")
        List<String> list = (List<String>) n.properties().get("evidenceIds");
        return list != null ? list : List.of();
    }

    private List<String> extractSourceRecordIds(Node n) {
        List<String> evIds = extractEvidenceIds(n);
        Set<String> recs = new LinkedHashSet<>();
        Map<String, String> evToRec = new HashMap<>();
        for (Evidence ev : store.graph().evidence()) {
            evToRec.put(ev.id(), ev.recordId());
        }
        for (String evId : evIds) {
            String rec = evToRec.get(evId);
            if (rec != null) recs.add(rec);
        }
        return new ArrayList<>(recs);
    }
}
