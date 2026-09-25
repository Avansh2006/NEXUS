package systems.nexus;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static systems.nexus.Model.*;

class SourceCoverageTest {
    final ObjectMapper json=new ObjectMapper();
    Source source(String id,String kind,String reliability,String credibility) {
        var p=json.createObjectNode().put("caseId","A").put("date","2026-09-01T00:00:00Z").put("text","SYN-PHONE-001 SYN-PHONE-001");
        if(reliability!=null)p.put("sourceReliability",reliability);
        if(credibility!=null)p.put("informationCredibility",credibility);
        p.set("_entities",json.valueToTree(List.of(new Extracted("Phone","SYN-PHONE-001",0,13,1,"SYN-PHONE-001","",id),new Extracted("Phone","SYN-PHONE-001",14,27,1,"SYN-PHONE-001","",id))));
        return new Source(id,kind,p);
    }
    Map<?,?> support(Graph g) { return (Map<?,?>)g.nodes().stream().filter(n->n.type().equals("Phone")).findFirst().orElseThrow().properties().get("support"); }
    @Test void narrativesAndIndependentSupport() {
        var a=source("a","intel-report","A","1"); var b=source("b","surveillance-report","B","2");
        assertThat(support(new GraphBuilder(json,Map.of(),Map.of()).build(List.of(a))).get("level")).isEqualTo("Low");
        var g=new GraphBuilder(json,Map.of(),Map.of()).build(List.of(a,b));
        assertThat(support(g).get("level")).isEqualTo("High");
        assertThat(support(g).get("recordCount")).isEqualTo(2);
        assertThat(g.edges()).allMatch(e->((Map<?,?>)e.properties().get("support")).get("level").equals("High"));
        assertThat(support(new GraphBuilder(json,Map.of(),Map.of()).build(List.of(a,source("b","criminal-history",null,null)))).get("level")).isEqualTo("Medium");
        assertThat(support(new GraphBuilder(json,Map.of(),Map.of()).build(List.of(a,source("b","criminal-history","F","6")))).get("level")).isEqualTo("Low");
    }
    @Test void supportUsesMinimumConfidenceAndSourceKindDiversity() {
        var a=source("a","fir","A","1"); var b=source("b","fir","A","1");
        assertThat(support(new GraphBuilder(json,Map.of(),Map.of()).build(List.of(a,b))).get("level")).isEqualTo("Medium");
        ((com.fasterxml.jackson.databind.node.ObjectNode)b.payload().path("_entities").get(1)).put("confidence",.79);
        var g=new GraphBuilder(json,Map.of(),Map.of()).build(List.of(a,b));
        assertThat(support(g).get("level")).isEqualTo("Low");
        assertThat(g.edges()).allMatch(e->((Map<?,?>)e.properties().get("support")).get("level").equals("Low"));
    }
    @Test void gradesRejectMalformedRowsBeforePersistence() {
        Store store=mock(Store.class); EngineClient engine=mock(EngineClient.class);
        var service=new InvestigationService(store,engine,json,"unused");
        var bad=source("x","intel-report","Z","1").payload();
        var result=service.ingest("intel-report",new IngestRequest(List.of(bad),null,null));
        assertThat(result.errors()).hasSize(1); assertThat(result.accepted()).isZero(); verifyNoInteractions(engine);
    }
    @Test void malformedGradesAndScalarRowsAreIndependentErrors() {
        Store store=mock(Store.class); EngineClient engine=mock(EngineClient.class);
        var service=new InvestigationService(store,engine,json,"unused");
        List<com.fasterxml.jackson.databind.JsonNode> rows=new ArrayList<>();
        rows.add(null); rows.add(json.nullNode()); rows.add(json.getNodeFactory().textNode("scalar"));
        for(String grade:List.of("", "a", "G", " A")) rows.add(source("x","fir",grade,"1").payload());
        for(String grade:List.of("", "0", "7", "1.0", " 1")) rows.add(source("x","fir","A",grade).payload());
        rows.add(((com.fasterxml.jackson.databind.node.ObjectNode)source("x","fir","A","1").payload()).putNull("sourceReliability"));
        var result=service.ingest("intel-report",new IngestRequest(rows,null,null));
        assertThat(result.errors()).hasSize(rows.size()); assertThat(result.accepted()).isZero(); verifyNoInteractions(engine);
    }
    @Test void narrativeIngestionPreservesRowsAndNormalizesDuplicates() {
        Store store=mock(Store.class); EngineClient engine=mock(EngineClient.class);
        when(store.state(anyString())).thenReturn(json.createObjectNode());
        when(store.sources()).thenReturn(List.of());
        when(store.encode(any())).thenAnswer(i->json.writeValueAsString(i.getArgument(0)));
        Set<String> hashes=new HashSet<>(); when(store.exists(anyString())).thenAnswer(i->!hashes.add(i.getArgument(0)));
        when(engine.extract(anyString(),anyString())).thenReturn(new Extraction(List.of()));
        var service=new InvestigationService(store,engine,json,"unused");
        for(String kind:List.of("criminal-history","intel-report","surveillance-report")) {
            var row=json.createObjectNode().put("caseId","A").put("date","2026-09-01T00:00:00Z").put("text","Original source text").put("sourceReliability","A").put("informationCredibility",1);
            var duplicate=row.deepCopy().put("informationCredibility","1");
            var bad=row.deepCopy().put("informationCredibility",1.5);
            var result=service.ingest(kind,new IngestRequest(List.of(row,duplicate,bad),null,null));
            assertThat(result.accepted()).isEqualTo(1); assertThat(result.duplicates()).isEqualTo(1); assertThat(result.errors()).hasSize(1);
        }
    }
    @Test void convertsCodePointsToUtf16ExactlyOnce() {
        String text="🔎 रवि कुमार";
        var result=EngineClient.utf16(text,new Extraction(List.of(new Extracted("Person","रवि कुमार",2,11,.86,"रवि कुमार","accused","a"))));
        var e=result.entities().get(0);
        assertThat(text.substring(e.start(),e.end())).isEqualTo("रवि कुमार");
        assertThat(e.start()).isEqualTo(3);
    }
}
