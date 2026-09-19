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
    private final Map<String,Deque<Long>> requests=new HashMap<>();
    public RequestGuard(@Value("${nexus.frontend-origin}") String origin) {this.origin=origin;}
    private void fail(HttpServletResponse r,int status,String code,String message) throws IOException {r.setStatus(status);r.setContentType("application/json");r.getWriter().write("{\"error\":{\"code\":\""+code+"\",\"message\":\""+message+"\"}}");}
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
        res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","DENY");res.setHeader("Cache-Control","no-store");
        String supplied=req.getHeader("Origin");
        if(supplied!=null&&!supplied.equals(origin)) {fail(res,403,"ORIGIN_DENIED","Origin not allowed");return;}
        if(supplied!=null) {res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization, X-Nexus-Role");}
        if(req.getMethod().equals("OPTIONS")) {res.setStatus(204);return;}

        // Authenticate request: check Bearer token or X-Nexus-Role, fallback to default ADMIN
        Auth.UserPrincipal principal = null;
        String authHeader = req.getHeader("Authorization");
        if (authHeader != null && !authHeader.isBlank()) {
            principal = Auth.authenticateToken(authHeader);
            if (principal == null) {
                fail(res, 401, "UNAUTHORIZED", "Invalid authentication token");
                return;
            }
        }
        if (principal == null) {
            String roleHeader = req.getHeader("X-Nexus-Role");
            if (roleHeader != null && !roleHeader.isBlank()) {
                String role = roleHeader.trim().toUpperCase();
                principal = new Auth.UserPrincipal(role.toLowerCase() + "@nexus.internal", role);
            }
        }
        if (principal == null) {
            principal = new Auth.UserPrincipal("admin@nexus.internal", "ADMIN");
        }

        req.setAttribute("nexus.user", principal.username());
        req.setAttribute("nexus.role", principal.role());
        res.setHeader("X-Nexus-User", principal.username());
        res.setHeader("X-Nexus-Role", principal.role());

        // Role-based access control: VIEWER role cannot perform mutations (POST) except login
        if ("VIEWER".equalsIgnoreCase(principal.role()) && req.getMethod().equals("POST") && !req.getRequestURI().endsWith("/auth/login")) {
            fail(res, 403, "FORBIDDEN", "Role VIEWER is not authorized to mutate data");
            return;
        }

        if(req.getMethod().equals("POST")) {
            long now=System.currentTimeMillis();
            synchronized(requests) {
                requests.entrySet().removeIf(e->e.getValue().isEmpty()||e.getValue().peekLast()<now-60000);
                Deque<Long> times=requests.computeIfAbsent(req.getRemoteAddr(),k->new ArrayDeque<>());
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
