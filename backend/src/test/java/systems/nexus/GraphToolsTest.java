package systems.nexus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class GraphToolsTest {
 Model.Graph graph(){return new Model.Graph(List.of(new Model.Node("a","Person","=A\"<&\n",Map.of("support",Map.of("level","Low"))),new Model.Node("b","Phone","B",Map.of()),new Model.Node("c","Phone","C",Map.of()),new Model.Node("d","Phone","D",Map.of()),new Model.Node("case","Case","Case",Map.of())),List.of(new Model.Edge("ab","a","b","LINK",Map.of()),new Model.Edge("bc","b","c","LINK",Map.of()),new Model.Edge("dc","d","case","CONNECTED_TO_CASE",Map.of())),List.of(new Model.Evidence("ev","record","a",null,0,1,null,"raw",.8)),List.of(),new ObjectMapper().createObjectNode(),false,List.of());}
 @Test void simulationExcludesCasesAndDoesNotMutate(){var g=graph();var result=GraphTools.remove(g,List.of("b"));assertEquals(2,result.before().components());assertEquals(3,result.after().components());assertEquals(2,result.removedEdges());assertEquals(List.of("b"),result.articulationPoints());assertEquals(5,g.nodes().size());assertThrows(IllegalArgumentException.class,()->GraphTools.remove(g,List.of("case")));assertThrows(IllegalArgumentException.class,()->GraphTools.remove(g,List.of("b","b")));}
 @Test void cyclesAndAllRemovedAndEmptyGraphs(){var g=graph();var cycle=new Model.Graph(g.nodes().subList(0,3),List.of(g.edges().get(0),g.edges().get(1),new Model.Edge("ca","c","a","LINK",Map.of())),List.of(),List.of(),g.analysis(),false,List.of());assertTrue(GraphTools.remove(cycle,List.of("b")).articulationPoints().isEmpty());var all=GraphTools.remove(cycle,List.of("a","b","c"));assertEquals(new GraphTools.Metrics(0,0,0),all.after());assertEquals(3,all.removedEdges());assertThrows(IllegalArgumentException.class,()->GraphTools.remove(g,List.of()));assertThrows(IllegalArgumentException.class,()->GraphTools.remove(g,List.of("unknown")));assertThrows(IllegalArgumentException.class,()->GraphTools.remove(g,java.util.stream.IntStream.range(0,21).mapToObj(i->"n"+i).toList()));}
 @Test void exportsEscapeAndDeclareKeys() throws Exception {
  String csv=GraphTools.nodesCsv(graph());
  try(var parsed=org.apache.commons.csv.CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).get().parse(new java.io.StringReader(csv))){
   var rows=parsed.getRecords();assertEquals("'=A\"<&\n",rows.get(0).get("label"));
   assertEquals("Low",new ObjectMapper().readTree(rows.get(0).get("support")).path("level").asText());
   assertEquals("ev",new ObjectMapper().readTree(rows.get(0).get("evidenceIds")).get(0).asText());
  }
  var factory=javax.xml.parsers.DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);
  var doc=factory.newDocumentBuilder().parse(new java.io.ByteArrayInputStream(GraphTools.graphml(graph()).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
  assertEquals(5,doc.getElementsByTagNameNS("http://graphml.graphdrawing.org/xmlns","node").getLength());
  var declared=new HashSet<String>();var keys=doc.getElementsByTagNameNS("http://graphml.graphdrawing.org/xmlns","key");
  for(int i=0;i<keys.getLength();i++)declared.add(((org.w3c.dom.Element)keys.item(i)).getAttribute("id"));
  var data=doc.getElementsByTagNameNS("http://graphml.graphdrawing.org/xmlns","data");
  for(int i=0;i<data.getLength();i++)assertTrue(declared.contains(((org.w3c.dom.Element)data.item(i)).getAttribute("key")));
  assertTrue(doc.getDocumentElement().getTextContent().contains("=A\"<&\n"));
 }
 @Test void reportPreservesEvidenceSupportAndSourceAssessment() {
  var base=graph();
  var payload=new ObjectMapper().createObjectNode().put("sourceReliability","F").put("informationCredibility","6");
  var g=new Model.Graph(base.nodes(),base.edges(),base.evidence(),List.of(new Model.Source("record","intel-report",payload)),base.analysis(),false,List.of());
  String report=Report.render(g,null);
  assertTrue(report.contains("Evidence support")); assertTrue(report.contains("Low"));
  assertTrue(report.contains("Source reliability")); assertTrue(report.contains("Information credibility"));
  assertTrue(report.contains("Unassessed")); assertTrue(report.contains("intel-report"));
 }
 @Test void exportsAreDeterministicAcrossPropertyMapOrder() {
  var first=new LinkedHashMap<String,Object>();first.put("lastSeen","2026-09-23T00:00:00Z");first.put("support",Map.of("level","Low"));
  var second=new LinkedHashMap<String,Object>();second.put("support",Map.of("level","Low"));second.put("lastSeen","2026-09-23T00:00:00Z");
  var base=graph();
  var a=new Model.Graph(List.of(new Model.Node("a","Person","a",first)),List.of(),List.of(),List.of(),base.analysis(),false,List.of());
  var b=new Model.Graph(List.of(new Model.Node("a","Person","a",second)),List.of(),List.of(),List.of(),base.analysis(),false,List.of());
  assertEquals(GraphTools.nodesCsv(a),GraphTools.nodesCsv(b));assertEquals(GraphTools.graphml(a),GraphTools.graphml(b));
 }
 String graphDigest(Model.Graph graph) {
  var matcher=java.util.regex.Pattern.compile("Graph data SHA-256:</b> <code>([a-f0-9]{64})</code>").matcher(Report.render(graph,null));
  assertTrue(matcher.find());return matcher.group(1);
 }
 @Test void reportDigestCoversContentsAndCanonicalizesMapKeys() {
  var base=graph();var nodes=new ArrayList<>(base.nodes());
  nodes.set(0,new Model.Node("a","Person","changed label",nodes.get(0).properties()));
  var changed=new Model.Graph(nodes,base.edges(),base.evidence(),base.records(),base.analysis(),false,List.of());
  assertNotEquals(graphDigest(base),graphDigest(changed));assertEquals(graphDigest(base),graphDigest(base));
  var analysis1=new ObjectMapper().createObjectNode().put("z",1).put("a",2);
  var analysis2=new ObjectMapper().createObjectNode().put("a",2).put("z",1);
  var a=new Model.Graph(base.nodes(),base.edges(),base.evidence(),base.records(),analysis1,false,List.of());
  var b=new Model.Graph(base.nodes(),base.edges(),base.evidence(),base.records(),analysis2,false,List.of());
  assertEquals(graphDigest(a),graphDigest(b));
 }
}

