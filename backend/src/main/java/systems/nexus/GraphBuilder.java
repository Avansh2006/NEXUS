package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import static systems.nexus.Model.*;

/** Pure reconstruction from immutable records and explicit investigator decisions. */
public final class GraphBuilder {
    private final Map<String,Node> nodes=new TreeMap<>();
    private final Map<String,Edge> edges=new TreeMap<>();
    private final List<Evidence> evidence=new ArrayList<>();
    private final Map<String,String> aliases;
    private final Map<String,String> decisions;
    private final ObjectMapper json;
    public GraphBuilder(ObjectMapper json, Map<String,String> aliases, Map<String,String> decisions) {
        this.json=json; this.aliases=aliases; this.decisions=decisions;
    }
    public static String hash(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e) { throw new IllegalStateException(e); }
    }
    public static String id(String type,String value) { return type.toLowerCase()+"-"+hash(value).substring(0,20); }
    public static String phone(String value) {
        if(value.matches("SYN-PHONE-\\d{3}")) return value;
        String n=value.replaceAll("[ +()-]","");
        if(n.matches("91[6-9]\\d{9}")) return "+"+n;
        if(n.matches("[6-9]\\d{9}")) return "+91"+n;
        throw new IllegalArgumentException("Phone must be an Indian mobile number or SYN-PHONE-000 token");
    }
    public static String account(String value) {
        if(value.matches("SYN-ACCOUNT-\\d{3}|\\d{9,18}|[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]+")) return value.startsWith("SYN-")?value:value.toLowerCase(Locale.ROOT);
        throw new IllegalArgumentException("Invalid account or UPI identifier");
    }
    @SuppressWarnings("unchecked")
    private static List<String> strings(Map<String,Object> p,String key) { return (List<String>)p.computeIfAbsent(key,k->new ArrayList<String>()); }
    private static void add(Map<String,Object> p,String key,String value) { var values=strings(p,key); if(!values.contains(value)) { values.add(value); Collections.sort(values); } }
    private String alias(String nid) { Set<String> seen=new HashSet<>(); while(aliases.containsKey(nid)&&seen.add(nid)) nid=aliases.get(nid); return nid; }
    private String node(String type,String key,String label,String caseId,Source s,Integer start,Integer end,double confidence) {
        String nid=alias(id(type,key));
        Node n=nodes.computeIfAbsent(nid,k->new Node(k,type,label,new LinkedHashMap<>()));
        add(n.properties(),"caseIds",caseId);
        String eid="ev-"+hash(s.id()+"|"+nid+"|"+start+"|"+end).substring(0,24);
        add(n.properties(),"evidenceIds",eid);
        if(evidence.stream().noneMatch(e->e.id().equals(eid))) evidence.add(new Evidence(eid,s.id(),nid,null,start,end,s.payload().path("_row").asInt(1),label,confidence));
        return nid;
    }
    @SuppressWarnings("unchecked")
    private void edge(String from,String to,String type,String caseId,Source s,String timestamp,double amount) {
        if(from.equals(to)) return;
        if(type.equals("CO_ACCUSED") && from.compareTo(to)>0) { String tmp=from;from=to;to=tmp; }
        String edgeId=id("edge",from+"|"+type+"|"+to);
        Edge e=edges.get(edgeId);
        if(e==null) { e=new Edge(edgeId,from,to,type,new LinkedHashMap<>()); edges.put(edgeId,e); }
        add(e.properties(),"caseIds",caseId);
        String eid="ev-"+hash(s.id()+"|"+edgeId).substring(0,24);
        add(e.properties(),"evidenceIds",eid);
        if(evidence.stream().noneMatch(x->x.id().equals(eid))) {
            evidence.add(new Evidence(eid,s.id(),null,edgeId,null,null,s.payload().path("_row").asInt(1),type,1));
            var events=(List<Map<String,Object>>)e.properties().computeIfAbsent("events",k->new ArrayList<>());
            events.add(Map.of("timestamp",timestamp,"evidenceId",eid,"amount",amount));
        }
        String first=(String)e.properties().getOrDefault("firstSeen",timestamp),last=(String)e.properties().getOrDefault("lastSeen",timestamp);
        e.properties().put("firstSeen",first.compareTo(timestamp)<0?first:timestamp);
        e.properties().put("lastSeen",last.compareTo(timestamp)>0?last:timestamp);
    }
    public Graph build(List<Source> sources) {
        for(Source s:sources) {
            JsonNode p=s.payload(); String c=p.path("caseId").asText(), time=p.path(s.kind().equals("fir")?"date":"timestamp").asText();
            String caseNode=node("Case",c,c,c,s,null,null,1);
            if(s.kind().equals("fir")) {
                nodes.get(caseNode).properties().put("crimeType",p.path("crimeType").asText("Unspecified"));
                List<Extracted> extracted=new ArrayList<>();
                for(JsonNode raw:p.path("_entities")) extracted.add(json.convertValue(raw,Extracted.class));
                Map<Integer,String> personIds=new HashMap<>();
                List<String> accused=new ArrayList<>();
                for(int i=0;i<extracted.size();i++) {
                    Extracted x=extracted.get(i); if(!x.type().equals("Person")) continue;
                    String corroboration="case:"+c;
                    for(int j=i+1;j<extracted.size()&&!extracted.get(j).type().equals("Person");j++) {
                        if(extracted.get(j).type().equals("Phone")&&!extracted.get(j).normalized().equals("SYN-PHONE-999")) { corroboration="phone:"+extracted.get(j).normalized();break; }
                    }
                    String pid=node("Person",x.normalized()+"|"+corroboration,x.raw(),c,s,x.start(),x.end(),x.confidence());
                    add(nodes.get(pid).properties(),"roles",x.role());
                    add(nodes.get(pid).properties(),"corroboration",corroboration);
                    personIds.put(i,pid);
                    if(x.role().contains("accused")) accused.add(pid);
                }
                String currentPerson=null;
                for(int i=0;i<extracted.size();i++) {
                    Extracted x=extracted.get(i);
                    if(x.type().equals("Amount")||x.type().equals("IFSC")) continue;
                    String nid;
                    if(x.type().equals("Person")) { currentPerson=personIds.get(i);nid=currentPerson; }
                    else nid=node(x.type(),x.normalized(),x.normalized(),c,s,x.start(),x.end(),x.confidence());
                    edge(nid,caseNode,"CONNECTED_TO_CASE",c,s,time,0);
                    if(currentPerson!=null&&!nid.equals(currentPerson)) {
                        String relation=switch(x.type()) { case "Phone" -> "USES";case "Account","Vehicle" -> "OWNS";case "Location" -> "SEEN_AT";default -> "LOCATED_AT";};
                        edge(currentPerson,nid,relation,c,s,time,0);
                    }
                }
                for(int i=0;i<accused.size();i++) for(int j=i+1;j<accused.size();j++) edge(accused.get(i),accused.get(j),"CO_ACCUSED",c,s,time,0);
            } else {
                boolean call=s.kind().equals("cdr"); String type=call?"Phone":"Account";
                String a=p.path("from").asText(),b=p.path("to").asText();
                a=call?phone(a):account(a);b=call?phone(b):account(b);
                String from=node(type,a,a,c,s,null,null,1),to=node(type,b,b,c,s,null,null,1);
                edge(from,to,call?"CALLED":"TRANSFERRED_TO",c,s,time,p.path("amount").asDouble(0));
                edge(from,caseNode,"CONNECTED_TO_CASE",c,s,time,0);edge(to,caseNode,"CONNECTED_TO_CASE",c,s,time,0);
                if(call&&!p.path("location").asText().isBlank()) {
                    String loc=p.path("location").asText(); String lid=node("Location",loc,loc,c,s,null,null,1);
                    edge(from,lid,"SEEN_AT",c,s,time,0);
                }
            }
        }
        List<Suggestion> suggestions=new ArrayList<>();
        var people=nodes.values().stream().filter(n->n.type().equals("Person")).toList();
        for(int i=0;i<people.size();i++) for(int j=i+1;j<people.size();j++) {
            Node a=people.get(i),b=people.get(j);
            double score=similarity(a.label().toLowerCase(Locale.ROOT),b.label().toLowerCase(Locale.ROOT));
            if(score>=.78) {
                String sid=id("match",a.id()+"|"+b.id());
                suggestions.add(new Suggestion(sid,a.id(),b.id(),score,"Similar name; distinct corroborating identifiers. Human review required.",decisions.getOrDefault(sid,"pending")));
            }
        }
        return new Graph(new ArrayList<>(nodes.values()),new ArrayList<>(edges.values()),evidence,sources,json.createObjectNode(),false,suggestions);
    }
    static double similarity(String a,String b) {
        int[][] d=new int[a.length()+1][b.length()+1];
        for(int i=0;i<=a.length();i++) d[i][0]=i; for(int j=0;j<=b.length();j++) d[0][j]=j;
        for(int i=1;i<=a.length();i++) for(int j=1;j<=b.length();j++) d[i][j]=Math.min(Math.min(d[i-1][j]+1,d[i][j-1]+1),d[i-1][j-1]+(a.charAt(i-1)==b.charAt(j-1)?0:1));
        return 1.0-(double)d[a.length()][b.length()]/Math.max(a.length(),b.length());
    }
}
