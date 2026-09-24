package systems.nexus;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import static systems.nexus.Model.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class InvestigationController {
    private final IntelligenceSuiteService suiteService;

    public InvestigationController(IntelligenceSuiteService suiteService) {
        this.suiteService = suiteService;
    }

    // 1. Investigation Replay
    @GetMapping("/investigation/replay")
    public ReplayResponse replay(@RequestParam(required = false) Integer step) {
        return suiteService.replay(step);
    }

    // 2. Counterfactual / What-If Analysis
    @PostMapping("/investigation/what-if")
    public WhatIfResponse whatIf(@RequestBody(required = false) WhatIfRequest request) {
        return suiteService.whatIf(request);
    }

    // 3. Contradiction Engine
    @GetMapping("/investigation/contradictions")
    public List<Contradiction> contradictions() {
        return suiteService.contradictions();
    }

    @PostMapping("/investigation/contradictions/{id}/review")
    public ContradictionReview reviewContradiction(
            @PathVariable String id,
            @RequestBody ContradictionReviewRequest request,
            HttpServletRequest req) {
        String author = (String) req.getAttribute("nexus.user");
        if (author == null || author.isBlank()) author = "investigator";
        return suiteService.reviewContradiction(id, request, author);
    }

    // 4. Evidence Trail Mode
    @GetMapping({"/evidence/path", "/evidence/trail"})
    public EvidenceTrailResponse evidenceTrail(@RequestParam String from, @RequestParam String to) {
        return suiteService.evidenceTrail(from, to);
    }

    // 5. Investigation Gap Finder
    @GetMapping("/investigation/gaps")
    public GapsResponse gaps() {
        return suiteService.gaps();
    }

    // 6. Network Change Radar
    @GetMapping("/analysis/changes")
    public NetworkChangesResponse changes() {
        return suiteService.changes();
    }
}
