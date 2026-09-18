package systems.nexus;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.Map;

@RestControllerAdvice
public class ApiErrors {
    private ResponseEntity<Map<String,Object>> error(int status,String code,String message) {return ResponseEntity.status(status).body(Map.of("error",Map.of("code",code,"message",message)));}
    @ExceptionHandler({IllegalArgumentException.class,HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String,Object>> invalid(Exception e) {return error(400,"INVALID_INPUT",e instanceof HttpMessageNotReadableException?"Malformed request body":e.getMessage());}
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String,Object>> status(ResponseStatusException e) {return error(e.getStatusCode().value(),"REQUEST_FAILED",e.getReason()==null?"Request failed":e.getReason());}
    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<Map<String,Object>> sidecar(RestClientException e) {return error(503,"ENGINE_UNAVAILABLE","Intelligence engine unavailable. Retry when its health check passes.");}
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> unknown(Exception e) {org.slf4j.LoggerFactory.getLogger(ApiErrors.class).error("Request failed",e);return error(500,"INTERNAL_ERROR","Request could not be completed");}
}
