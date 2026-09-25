package systems.nexus;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class RequestGuard extends OncePerRequestFilter {
    private final String origin;
    private final Auth auth;
    private final Map<String,Deque<Long>> requests=new HashMap<>();
    public RequestGuard(@Value("${nexus.frontend-origin}") String origin,Auth auth) {this.origin=origin;this.auth=auth;}
    private boolean isAllowedOrigin(String supplied) {
        if (supplied == null) return false;
        if ("*".equals(origin)) return true;
        for (String allowed : origin.split(",")) {
            String trimmed = allowed.trim();
            if (trimmed.equals(supplied)) return true;
            if (trimmed.startsWith("*.") && supplied.endsWith(trimmed.substring(1))) return true;
        }
        return false;
    }
    private void fail(HttpServletResponse r,int status,String code,String message) throws IOException {r.setStatus(status);r.setContentType("application/json");r.getWriter().write("{\"error\":{\"code\":\""+code+"\",\"message\":\""+message+"\"}}");}
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
        String requestId=UUID.randomUUID().toString();
        req.setAttribute("nexus.requestId",requestId);
        res.setHeader("X-Request-ID",requestId);
        res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","DENY");res.setHeader("Cache-Control","no-store");
        String supplied=req.getHeader("Origin");
        if(supplied!=null&&!isAllowedOrigin(supplied)) {fail(res,403,"ORIGIN_DENIED","Origin not allowed");return;}
        if(supplied!=null) {res.setHeader("Access-Control-Allow-Origin", supplied);res.setHeader("Vary","Origin");res.setHeader("Access-Control-Allow-Methods","GET, POST, DELETE, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");res.setHeader("Access-Control-Expose-Headers","X-Request-ID, Retry-After, Content-Disposition");}
        if(req.getMethod().equals("OPTIONS")) {res.setStatus(204);return;}

        String path=req.getRequestURI();
        boolean login=path.equals("/api/auth/login")&&req.getMethod().equals("POST");
        boolean health=path.equals("/api/health")&&req.getMethod().equals("GET");
        Auth.UserPrincipal principal=auth.authenticateToken(req.getHeader("Authorization"));
        if(!login&&!health) {
            if(principal==null) {fail(res,401,"UNAUTHORIZED","Sign in to access this investigation");return;}
            req.setAttribute("nexus.user",principal.username());
            req.setAttribute("nexus.role",principal.role());
            boolean adminOnly=path.startsWith("/api/demo/")||path.equals("/api/diagnostics");
            boolean readPost=path.equals("/api/reports")||path.equals("/api/what-if/remove")||path.equals("/api/vision/search")||path.equals("/api/investigation/what-if")||path.equals("/api/evidence/visual-search");
            if((adminOnly&&!principal.role().equals("ADMIN"))||
                ((req.getMethod().equals("POST")||req.getMethod().equals("DELETE"))&&!readPost&&principal.role().equals("VIEWER"))) {
                fail(res,403,"FORBIDDEN","Your role is not authorized for this action");return;
            }
        }

        if(req.getMethod().equals("POST")) {
            long now=System.currentTimeMillis();
            synchronized(requests) {
                requests.entrySet().removeIf(e->e.getValue().isEmpty()||e.getValue().peekLast()<now-60000);
                String bucket=login?"login:"+req.getRemoteAddr():"mutations:"+principal.username();
                Deque<Long> times=requests.computeIfAbsent(bucket,k->new ArrayDeque<>());
                while(!times.isEmpty()&&times.peek()<now-60000) times.remove();
                if(times.size()>=30) {
                    long oldest = times.peek();
                    long resetSecs = Math.max(1, ((oldest + 60000) - now) / 1000);
                    res.setHeader("Retry-After", String.valueOf(resetSecs));
                    res.setHeader("X-RateLimit-Limit", "30");
                    res.setHeader("X-RateLimit-Remaining", "0");
                    res.setHeader("X-RateLimit-Reset", String.valueOf((oldest + 60000) / 1000));
                    fail(res,429,"RATE_LIMIT","Maximum 30 mutations per minute");
                    return;
                }
                times.add(now);
                res.setHeader("X-RateLimit-Limit", "30");
                res.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, 30 - times.size())));
                res.setHeader("X-RateLimit-Reset", String.valueOf((times.peek() + 60000) / 1000));
            }
            String contentType = req.getContentType();
            boolean isMultipart = contentType != null && contentType.toLowerCase().startsWith("multipart/");
            if(isMultipart) {
                if(req.getContentLengthLong() > 10485760) {fail(res,413,"TOO_LARGE","Request exceeds 10 MiB");return;}
                chain.doFilter(req,res);
                return;
            }
            byte[] body=req.getInputStream().readNBytes(2097153);
            if(body.length>2097152) {fail(res,413,"TOO_LARGE","Request exceeds 2 MiB");return;}
            try {StandardCharsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(body));} catch(java.nio.charset.CharacterCodingException e) {fail(res,400,"INVALID_ENCODING","UTF-8 required");return;}
            chain.doFilter(new HttpServletRequestWrapper(req) {
                @Override public ServletInputStream getInputStream() {ByteArrayInputStream in=new ByteArrayInputStream(body);return new ServletInputStream() {
                    public int read() {return in.read();}public boolean isFinished() {return in.available()==0;}public boolean isReady() {return true;}public void setReadListener(ReadListener listener) {throw new UnsupportedOperationException();}
                };}
                @Override public BufferedReader getReader() {return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
            },res);return;
        }
        chain.doFilter(req,res);
    }
}
