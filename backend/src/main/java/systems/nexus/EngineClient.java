package systems.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.util.Map;

@Component
public class EngineClient {
    private final RestClient client;
    private final RestClient healthClient;
    public EngineClient(@Value("${nexus.intelligence-url}") String url) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000); factory.setReadTimeout(15000);
        client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
        var healthFactory = new SimpleClientHttpRequestFactory();
        healthFactory.setConnectTimeout(2000); healthFactory.setReadTimeout(2000);
        healthClient = RestClient.builder().baseUrl(url).requestFactory(healthFactory).build();
    }
    public Model.Extraction extract(String text, String id) {
        return utf16(text,client.post().uri("/extract").body(Map.of("text",text,"recordId",id)).retrieve().body(Model.Extraction.class));
    }
    static Model.Extraction utf16(String text, Model.Extraction result) {
        if(result==null || result.entities()==null) throw new IllegalStateException("Missing extraction response");
        int length=text.codePointCount(0,text.length());
        return new Model.Extraction(result.entities().stream().map(e->{
            if(e.start()<0 || e.end()<e.start() || e.end()>length) throw new IllegalStateException("Invalid extraction span");
            int start=text.offsetByCodePoints(0,e.start()),end=text.offsetByCodePoints(0,e.end());
            if(!text.substring(start,end).equals(e.raw())) throw new IllegalStateException("Extraction span does not match source");
            return new Model.Extracted(e.type(),e.raw(),start,end,e.confidence(),e.normalized(),e.role(),e.sourceRecordId());
        }).toList());
    }
    public JsonNode analyze(Model.Graph graph) { return client.post().uri("/analyze").body(graph).retrieve().body(JsonNode.class); }
    public JsonNode quality() { return client.get().uri("/quality").retrieve().body(JsonNode.class); }
    public JsonNode health() { return healthClient.get().uri("/health").retrieve().body(JsonNode.class); }
}
