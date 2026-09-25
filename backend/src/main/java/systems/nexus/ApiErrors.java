package systems.nexus;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.Map;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiErrors {
    private ResponseEntity<Map<String,Object>> error(int status,String code,String message) {return ResponseEntity.status(status).body(Map.of("error",Map.of("code",code,"message",message)));}
    @ExceptionHandler({IllegalArgumentException.class,HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String,Object>> invalid(Exception e) {return error(400,"INVALID_INPUT",e instanceof HttpMessageNotReadableException?"Malformed request body":e.getMessage());}
    @ExceptionHandler({ServletRequestBindingException.class,MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String,Object>> binding(Exception e) {return error(400,"INVALID_INPUT","Missing or invalid request parameter");}
    @ExceptionHandler({HttpRequestMethodNotSupportedException.class,HttpMediaTypeNotSupportedException.class,HttpMediaTypeNotAcceptableException.class,NoResourceFoundException.class})
    public ResponseEntity<Map<String,Object>> protocol(Exception e) {
        int status=((org.springframework.web.ErrorResponse)e).getStatusCode().value();
        return error(status,"REQUEST_FAILED",HttpStatus.valueOf(status).getReasonPhrase());
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String,Object>> status(ResponseStatusException e) {
        String code = e.getStatusCode().value() == 401 ? "UNAUTHORIZED" : e.getStatusCode().value() == 403 ? "FORBIDDEN" : "REQUEST_FAILED";
        return error(e.getStatusCode().value(), code, e.getReason() == null ? "Request failed" : e.getReason());
    }
    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<Map<String,Object>> sidecar(RestClientException e,jakarta.servlet.http.HttpServletRequest request) {
        org.slf4j.LoggerFactory.getLogger(ApiErrors.class).warn("engine_unavailable requestId={} exceptionType={}",request.getAttribute("nexus.requestId"),e.getClass().getSimpleName());
        return error(503,"ENGINE_UNAVAILABLE","Intelligence engine unavailable. Retry when its health check passes.");
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> unknown(Exception e,jakarta.servlet.http.HttpServletRequest request) {
        org.slf4j.LoggerFactory.getLogger(ApiErrors.class).error("request_failed requestId={} exceptionType={}",request.getAttribute("nexus.requestId"),e.getClass().getSimpleName());
        return error(500,"INTERNAL_ERROR","Request could not be completed; reference request ID "+request.getAttribute("nexus.requestId"));
    }
}
