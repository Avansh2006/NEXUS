package systems.nexus;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static systems.nexus.Model.*;

class GraphBuilderTest {
    final ObjectMapper json=new ObjectMapper();
    Source fir(String id,String c,String name,String phone) {
        var p=json.createObjectNode().put("caseId",c).put("date","2026-09-01T00:00:00Z").put("text",name+" "+phone);
        p.set("_entities",json.valueToTree(List.of(new Extracted("Person",name,0,name.length(),.86,name.toLowerCase(),"accused",id),new Extracted("Phone",phone,name.length()+1,name.length()+phone.length()+1,1,phone,"",id))));
        return new Source(id,"fir",p);
    }
    @Test void hardIdentifiersMergeButNamesNeedCorroboration() {
        Graph g=new GraphBuilder(json,Map.of(),Map.of()).build(List.of(fir("a","A","Rivan Kesh","SYN-PHONE-004"),fir("b","B","Rivan Kesh","SYN-PHONE-005"),fir("c","C","Rivan Kesh","SYN-PHONE-004")));
        assertThat(g.nodes().stream().filter(n->n.type().equals("Person"))).hasSize(2);
        assertThat(g.nodes().stream().filter(n->n.type().equals("Phone"))).hasSize(2);
        assertThat(g.suggestions()).hasSize(1);
        assertThat(g.evidence()).allMatch(e->e.recordId()!=null);
        assertThat(g.edges()).allMatch(e->!((List<?>)e.properties().get("evidenceIds")).isEmpty());
    }
    @Test void explicitMergeReconstructionCanBeReversed() {
        var sources=List.of(fir("a","A","Rivan Kesh","SYN-PHONE-004"),fir("b","B","Rivan Kesh","SYN-PHONE-005"));
        Graph before=new GraphBuilder(json,Map.of(),Map.of()).build(sources);
        Suggestion s=before.suggestions().get(0);
        Graph after=new GraphBuilder(json,Map.of(s.right(),s.left()),Map.of()).build(sources);
        assertThat(after.nodes()).hasSize(before.nodes().size()-1);
        assertThat(new GraphBuilder(json,Map.of(),Map.of()).build(sources)).isEqualTo(before);
    }
    @Test void validatesAndNormalizesIdentifiers() {
        assertThat(GraphBuilder.phone("+91 9876543210")).isEqualTo(GraphBuilder.phone("9876543210"));
        assertThatThrownBy(()->GraphBuilder.phone("12345")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->GraphBuilder.account("not an account")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void reportEscapesUntrustedText() {
        assertThat(Report.escape("<script>alert('x')</script>")).doesNotContain("<script>").contains("&lt;script&gt;");
    }
}
