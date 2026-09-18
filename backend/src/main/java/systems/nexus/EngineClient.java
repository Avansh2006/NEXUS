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
    public EngineClient(@Value("${nexus.intelligence-url}") String url) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000); factory.setReadTimeout(15000);
        client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
    public Model.Extraction extract(String text, String id) {
        return client.post().uri("/extract").body(Map.of("text",text,"recordId",id)).retrieve().body(Model.Extraction.class);
    }
    public JsonNode analyze(Model.Graph graph) { return client.post().uri("/analyze").body(graph).retrieve().body(JsonNode.class); }
    public JsonNode quality() { return client.get().uri("/quality").retrieve().body(JsonNode.class); }
}
