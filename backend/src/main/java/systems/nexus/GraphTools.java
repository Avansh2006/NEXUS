package systems.nexus;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.StringWriter;
import java.util.*;
import javax.xml.stream.*;

public final class GraphTools {
  private GraphTools() {}

  private static final ObjectMapper JSON =
      new ObjectMapper()
          .enable(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);

  public record Metrics(int components, int largestComponent, int isolatedNodes) {}

  public record Simulation(
      Metrics before,
      Metrics after,
      int removedEdges,
      List<String> articulationPoints,
      List<String> removedEntityIds) {}

  private static Map<String, Set<String>> adjacency(Model.Graph g) {
    var map = new TreeMap<String, Set<String>>();
    g.nodes().stream()
        .filter(n -> !"Case".equals(n.type()))
        .forEach(n -> map.put(n.id(), new TreeSet<>()));
    g.edges().stream()
        .filter(
            e ->
                !"CONNECTED_TO_CASE".equals(e.type())
                    && map.containsKey(e.source())
                    && map.containsKey(e.target()))
        .forEach(
            e -> {
              if (!e.source().equals(e.target())) {
                map.get(e.source()).add(e.target());
                map.get(e.target()).add(e.source());
              }
            });
    return map;
  }

  private static Metrics metrics(Map<String, Set<String>> map, Set<String> removed) {
    Set<String> seen = new HashSet<>(removed);
    int count = 0, largest = 0, isolated = 0;
    for (String id : map.keySet()) {
      if (removed.contains(id)) continue;
      if (map.get(id).stream().allMatch(removed::contains)) isolated++;
      if (!seen.add(id)) continue;
      count++;
      int size = 0;
      var queue = new ArrayDeque<String>();
      queue.add(id);
      while (!queue.isEmpty()) {
        String next = queue.remove();
        size++;
        for (String neighbor : map.get(next)) if (seen.add(neighbor)) queue.add(neighbor);
      }
      largest = Math.max(largest, size);
    }
    return new Metrics(count, largest, isolated);
  }

  public static Simulation remove(Model.Graph g, List<String> ids) {
    var map = adjacency(g);
    if (ids == null
        || ids.isEmpty()
        || ids.size() > 20
        || new HashSet<>(ids).size() != ids.size()
        || ids.stream().anyMatch(id -> id == null || !map.containsKey(id)))
      throw new IllegalArgumentException("Select 1–20 unique existing non-Case entities");
    var before = metrics(map, Set.of());
    var selected = new TreeSet<>(ids);
    int edges =
        (int)
            g.edges().stream()
                .filter(
                    e ->
                        !"CONNECTED_TO_CASE".equals(e.type())
                            && map.containsKey(e.source())
                            && map.containsKey(e.target())
                            && (selected.contains(e.source()) || selected.contains(e.target())))
                .count();
    return new Simulation(
        before,
        metrics(map, selected),
        edges,
        selected.stream()
            .filter(id -> metrics(map, Set.of(id)).components() > before.components())
            .toList(),
        List.copyOf(selected));
  }

  private static String json(Object value) {
    try {
      return JSON.writeValueAsString(value);
    } catch (Exception ex) {
      throw new IllegalStateException(ex);
    }
  }

  private static String csv(Object value) {
    String s = value == null ? "" : value.toString();
    String trimmed = s.stripLeading();
    if (!trimmed.isEmpty() && ("=+-@".indexOf(trimmed.charAt(0)) >= 0)
        || s.startsWith("\t")
        || s.startsWith("\r")
        || s.startsWith("\n")) s = "'" + s;
    return "\"" + s.replace("\"", "\"\"") + "\"";
  }

  private static void row(StringBuilder out, Object... values) {
    out.append(
            Arrays.stream(values)
                .map(GraphTools::csv)
                .collect(java.util.stream.Collectors.joining(",")))
        .append("\r\n");
  }

  private static List<String> evidence(Model.Graph g, String id, boolean edge) {
    return g.evidence().stream()
        .filter(e -> id.equals(edge ? e.edgeId() : e.entityId()))
        .map(Model.Evidence::id)
        .sorted()
        .toList();
  }

  private static List<String> records(Model.Graph g, String id, boolean edge) {
    return g.evidence().stream()
        .filter(e -> id.equals(edge ? e.edgeId() : e.entityId()))
        .map(Model.Evidence::recordId)
        .distinct()
        .sorted()
        .toList();
  }

  public static String nodesCsv(Model.Graph g) {
    var out = new StringBuilder();
    row(out, "id", "type", "label", "evidenceIds", "recordIds", "support", "properties");
    g.nodes().stream()
        .sorted(Comparator.comparing(Model.Node::id))
        .forEach(
            n ->
                row(
                    out,
                    n.id(),
                    n.type(),
                    n.label(),
                    json(evidence(g, n.id(), false)),
                    json(records(g, n.id(), false)),
                    json(n.properties().getOrDefault("support", Map.of())),
                    json(n.properties())));
    return out.toString();
  }

  public static String edgesCsv(Model.Graph g) {
    var out = new StringBuilder();
    row(out, "id", "source", "target", "type", "evidenceIds", "recordIds", "support", "properties");
    g.edges().stream()
        .sorted(Comparator.comparing(Model.Edge::id))
        .forEach(
            e ->
                row(
                    out,
                    e.id(),
                    e.source(),
                    e.target(),
                    e.type(),
                    json(evidence(g, e.id(), true)),
                    json(records(g, e.id(), true)),
                    json(e.properties().getOrDefault("support", Map.of())),
                    json(e.properties())));
    return out.toString();
  }

  private static final String NS = "http://graphml.graphdrawing.org/xmlns";

  private static void data(XMLStreamWriter xml, String key, String value)
      throws XMLStreamException {
    xml.writeStartElement("data");
    xml.writeAttribute("key", key);
    xml.writeCharacters(cleanXml(value));
    xml.writeEndElement();
  }

  private static String cleanXml(String value) {
    var out = new StringBuilder();
    value
        .codePoints()
        .filter(
            c ->
                c == 9
                    || c == 10
                    || c == 13
                    || c >= 32 && c <= 0xD7FF
                    || c >= 0xE000 && c <= 0xFFFD
                    || c >= 0x10000 && c <= 0x10FFFF)
        .forEach(out::appendCodePoint);
    return out.toString();
  }

  public static String graphml(Model.Graph g) {
    try {
      var out = new StringWriter();
      var xml = XMLOutputFactory.newFactory().createXMLStreamWriter(out);
      xml.writeStartDocument("UTF-8", "1.0");
      xml.writeStartElement("graphml");
      xml.writeDefaultNamespace(NS);
      for (String key :
          List.of("type", "label", "evidenceIds", "recordIds", "support", "properties")) {
        xml.writeEmptyElement("key");
        xml.writeAttribute("id", key);
        xml.writeAttribute("for", "all");
        xml.writeAttribute("attr.name", key);
        xml.writeAttribute("attr.type", "string");
      }
      xml.writeStartElement("graph");
      xml.writeAttribute("id", "nexus");
      xml.writeAttribute("edgedefault", "directed");
      for (var n : g.nodes().stream().sorted(Comparator.comparing(Model.Node::id)).toList()) {
        xml.writeStartElement("node");
        xml.writeAttribute("id", n.id());
        data(xml, "type", n.type());
        data(xml, "label", n.label());
        data(xml, "evidenceIds", json(evidence(g, n.id(), false)));
        data(xml, "recordIds", json(records(g, n.id(), false)));
        data(xml, "support", json(n.properties().getOrDefault("support", Map.of())));
        data(xml, "properties", json(n.properties()));
        xml.writeEndElement();
      }
      for (var e : g.edges().stream().sorted(Comparator.comparing(Model.Edge::id)).toList()) {
        xml.writeStartElement("edge");
        xml.writeAttribute("id", e.id());
        xml.writeAttribute("source", e.source());
        xml.writeAttribute("target", e.target());
        data(xml, "type", e.type());
        data(xml, "evidenceIds", json(evidence(g, e.id(), true)));
        data(xml, "recordIds", json(records(g, e.id(), true)));
        data(xml, "support", json(e.properties().getOrDefault("support", Map.of())));
        data(xml, "properties", json(e.properties()));
        xml.writeEndElement();
      }
      xml.writeEndElement();
      xml.writeEndElement();
      xml.writeEndDocument();
      xml.close();
      return out.toString();
    } catch (XMLStreamException ex) {
      throw new IllegalStateException(ex);
    }
  }
}
