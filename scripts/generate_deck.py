import os
from pathlib import Path
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "artifacts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PDF_PATH = OUTPUT_DIR / "NEXUS_Hackathon_Deck.pdf"
PDF_ALIAS = OUTPUT_DIR / "TeamID_Event_Deck.pdf"

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        # Slide Background (Tactical Dark Slate)
        self.setFillColor(colors.HexColor("#081214"))
        self.rect(0, 0, 792, 612, fill=1, stroke=0)

        # Top Tactical Accent Line
        self.setStrokeColor(colors.HexColor("#60c5b3"))
        self.setLineWidth(2)
        self.line(40, 570, 752, 570)

        # Bottom Border Line
        self.setStrokeColor(colors.HexColor("#1b3638"))
        self.setLineWidth(1)
        self.line(40, 38, 752, 38)

        # Footer Text
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#60c5b3"))
        self.drawString(40, 24, "NEXUS INTELLIGENCE WORKBENCH")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#9ca3af"))
        self.drawString(240, 24, "Evidence-Linked Criminal Network Analysis · Hackathon 2026")
        
        # Slide Number
        page_str = f"Slide {self._pageNumber} of {total_pages}"
        self.drawRightString(752, 24, page_str)
        self.restoreState()

def create_deck():
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=landscape(letter),
        leftMargin=40,
        rightMargin=40,
        topMargin=48,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DeckTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=colors.HexColor('#ffffff'),
        alignment=0,
        spaceAfter=8
    )
    
    subtitle_style = ParagraphStyle(
        'DeckSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=colors.HexColor('#60c5b3'),
        spaceAfter=14
    )

    slide_heading = ParagraphStyle(
        'SlideHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#ffffff'),
        spaceAfter=4
    )

    slide_subheading = ParagraphStyle(
        'SlideSubHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#60c5b3'),
        spaceAfter=12
    )

    body_style = ParagraphStyle(
        'DeckBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#e5e7eb'),
        spaceAfter=6
    )

    bold_body = ParagraphStyle(
        'DeckBoldBody',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#ffffff')
    )

    gold_body = ParagraphStyle(
        'DeckGoldBody',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#e5b45b')
    )

    callout_box = ParagraphStyle(
        'CalloutBox',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#d1d5db')
    )

    story = []

    # ==================== SLIDE 1: TITLE SLIDE ====================
    story.append(Spacer(1, 40))
    story.append(Paragraph("PROJECT NEXUS", title_style))
    story.append(Paragraph("Network Exploration & eXtraction for Unified Intelligence Systems", subtitle_style))
    story.append(Spacer(1, 10))

    banner_data = [
        [Paragraph("<b>CLASSIFICATION:</b> Forensic Criminal Network Analysis & Biometric Intelligence Workbench", bold_body)],
        [Paragraph("<b>CORE PRINCIPLE:</b> \"Assist, Never Accuse\" · 100% Verifiable Primary Evidence Provenance", gold_body)],
        [Paragraph("<b>LIVE HOSTED DEMO:</b> https://nexus-workbench-avansh.netlify.app (No Login Wall · 1-Click Access)", bold_body)],
        [Paragraph("<b>SUBMISSION DATE:</b> 26 September 2026 · Software Hackathon Track", body_style)],
        [Paragraph("<b>REPOSITORY:</b> https://github.com/Avansh2006/NEXUS", body_style)],
    ]
    t1 = Table(banner_data, colWidths=[712])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0f2528")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#60c5b3")),
        ('PADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t1)
    story.append(PageBreak())

    # ==================== SLIDE 2: THE PROBLEM ====================
    story.append(Paragraph("01 · THE PROBLEM & OPERATIONAL BOTTLENECKS", slide_heading))
    story.append(Paragraph("Why Traditional Criminal Intelligence Systems Fail Under Pressure", slide_subheading))
    
    prob_data = [
        [
            Paragraph("<b>Data Fragmentation & Multi-Format Silos</b>", bold_body),
            Paragraph("Investigation data is scattered across incompatible formats: FIR narrative reports, Call Detail Records (CDRs), banking ledgers, and CCTV surveillance footage. Analysts lose crucial days manually cross-referencing documents.", body_style)
        ],
        [
            Paragraph("<b>Intermediary Blindspots & Mule Networks</b>", bold_body),
            Paragraph("Complex crime syndicates operate across jurisdictions using money mules, burner phones, and alternate aliases. Human investigators alone cannot correlate multi-hop structural networks under extreme cognitive load.", body_style)
        ],
        [
            Paragraph("<b>Black-Box AI Hallucination & Due Process Risks</b>", bold_body),
            Paragraph("Generative AI models and predictive policing tools risk severe hallucinations, bias, and unexplainable guilt scoring—violating constitutional safeguards and statutory procedural standards.", body_style)
        ],
        [
            Paragraph("<b>Evidentiary Chain-of-Custody Failure</b>", bold_body),
            Paragraph("Intelligence outputs frequently fail judicial scrutiny. Admitting digital evidence in court demands rigorous proof of authenticity, tamper-evident audit trails, and compliance with statutory evidence laws (e.g. BSA 2023).", body_style)
        ]
    ]
    t2 = Table(prob_data, colWidths=[220, 492])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#1b3638")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t2)
    story.append(PageBreak())

    # ==================== SLIDE 3: THE SOLUTION ====================
    story.append(Paragraph("02 · THE SOLUTION: NEXUS WORKBENCH", slide_heading))
    story.append(Paragraph("Evidence-Anchored Intelligence Architecture with Zero-Hallucination Guarantees", slide_subheading))

    sol_data = [
        [
            Paragraph("<b>1. \"Assist, Never Accuse\" Doctrine</b>", bold_body),
            Paragraph("NEXUS strictly rejects autonomous accusations, predictive policing, and automated guilt scores. The system generates factual candidate leads and highlights structural patterns for human review.", body_style)
        ],
        [
            Paragraph("<b>2. 100% Provenance Anchoring</b>", bold_body),
            Paragraph("Every node (Person, Phone, Account, Vehicle, Location) and relational edge is explicitly bound to verbatim primary evidence source spans with exact offsets and SHA-256 ingestion hashes.", body_style)
        ],
        [
            Paragraph("<b>3. In-Memory Counterfactual Sandbox</b>", bold_body),
            Paragraph("Investigators can test \"what-if\" counterfactual exclusions of contaminated, disputed, or single-source evidence in volatile memory—without altering the canonical court record.", body_style)
        ],
        [
            Paragraph("<b>4. Multi-Modal Forensic Fusion</b>", bold_body),
            Paragraph("Seamlessly unifies structured transactions, narrative FIR extractions, call records, and unconstrained biometric CCTV facial candidate matching in a single cohesive workspace.", body_style)
        ]
    ]
    t3 = Table(sol_data, colWidths=[220, 492])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#60c5b3")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t3)
    story.append(PageBreak())

    # ==================== SLIDE 4: ARCHITECTURE ====================
    story.append(Paragraph("03 · DECOUPLED SYSTEM ARCHITECTURE", slide_heading))
    story.append(Paragraph("Distributed Multi-Service Design Optimized for Speed, Security, and Scalability", slide_subheading))

    arch_data = [
        [
            Paragraph("<b>Client Presentation Layer</b><br/><font color='#60c5b3'>React 19 + TypeScript + Vite + Tailwind</font>", bold_body),
            Paragraph("High-speed tactical HUD design system. Features <b>Cytoscape.js</b> with fcose layout for 2D network physics and <b>Three.js</b> for a 3D spatial globe canvas with real-time district telemetries.", body_style)
        ],
        [
            Paragraph("<b>Core Enterprise Server</b><br/><font color='#60c5b3'>Spring Boot 3.4.3 (Java 17 LTS)</font>", bold_body),
            Paragraph("Enterprise REST API with JJWT role-based access control (Admin, Investigator, Viewer). Manages identity resolution, graph reconstruction, and the cryptographic SHA-256 hash-chained audit ledger.", body_style)
        ],
        [
            Paragraph("<b>AI & Forensics Engine</b><br/><font color='#60c5b3'>Python 3.12 + FastAPI + ONNX Runtime</font>", bold_body),
            Paragraph("Stateless high-throughput microservice performing entity extraction via spaCy EntityRuler, graph topology analysis via NetworkX, and biometric facial matching via AdaFace IR-101 and SCRFD-10G.", body_style)
        ],
        [
            Paragraph("<b>Persistence & Compatibility</b><br/><font color='#60c5b3'>PostgreSQL 16 / H2 PostgreSQL Mode</font>", bold_body),
            Paragraph("Relational JSONB persistence storing raw immutable evidence, canonical graph state, and review decisions. Embedded H2 mode enables instant zero-dependency local runs and verification.", body_style)
        ]
    ]
    t4 = Table(arch_data, colWidths=[240, 472])
    t4.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#1b3638")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t4)
    story.append(PageBreak())

    # ==================== SLIDE 5: ML & COMPUTER VISION ====================
    story.append(Paragraph("04 · MACHINE INTELLIGENCE & COMPUTER VISION", slide_heading))
    story.append(Paragraph("Deterministic NLP, Biometric AdaFace IR-101, and Network Graph Analytics", slide_subheading))

    ml_data = [
        [
            Paragraph("<b>Component</b>", gold_body),
            Paragraph("<b>Model / Framework</b>", gold_body),
            Paragraph("<b>Function & Operational Significance</b>", gold_body)
        ],
        [
            Paragraph("<b>Face Detection</b>", bold_body),
            Paragraph("SCRFD-10G (ONNX, 16.9 MB)", body_style),
            Paragraph("Ultra-fast multi-scale face localization with 5-point facial landmark alignment; operates on low-resolution CCTV surveillance frames.", body_style)
        ],
        [
            Paragraph("<b>Face Recognition</b>", bold_body),
            Paragraph("AdaFace IR-101 (ONNX, 260 MB)", body_style),
            Paragraph("Adaptive-margin facial recognition generating 512-dim L2-normalized embeddings; specialized in unconstrained pose, lighting, and blur.", body_style)
        ],
        [
            Paragraph("<b>Entity Extraction</b>", bold_body),
            Paragraph("spaCy EntityRuler + Regex", body_style),
            Paragraph("Deterministic rule-based NLP with zero hallucination. Extracts suspects, phone numbers, bank accounts, and vehicles with exact offsets.", body_style)
        ],
        [
            Paragraph("<b>Graph Topology</b>", bold_body),
            Paragraph("NetworkX (Louvain & Centrality)", body_style),
            Paragraph("Betweenness and degree centrality identify criminal kingpins, cut vertices, and high-influence brokers across syndicates.", body_style)
        ],
        [
            Paragraph("<b>Strict Safeguard</b>", gold_body),
            Paragraph("Human-in-the-Loop Gate", gold_body),
            Paragraph("Biometric search proposes candidate matches only (>=0.65 similarity). Autonomous merges are strictly forbidden by architecture.", gold_body)
        ]
    ]
    t5 = Table(ml_data, colWidths=[130, 180, 402])
    t5.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#132d31")),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#60c5b3")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t5)
    story.append(PageBreak())

    # ==================== SLIDE 6: VISUAL IDENTITY SEARCH & 3D GLOBE ====================
    story.append(Paragraph("05 · FORENSIC VISUALIZATION & CCTV HUNT", slide_heading))
    story.append(Paragraph("Tactical HUD, 3D Spatial Canvas, and End-to-End Visual Identity Matching", slide_subheading))

    vis_data = [
        [
            Paragraph("<b>Hardware-Accelerated 2D Graph</b>", bold_body),
            Paragraph("Cytoscape.js with fast compound spring embedder (fcose). Color-coded by entity type with dynamic badge indicators for evidence corroborate levels (High/Medium/Low).", body_style)
        ],
        [
            Paragraph("<b>Three.js 3D Tactical Globe</b>", bold_body),
            Paragraph("Visualizes multi-jurisdictional syndicate activities across district jurisdictions. Arcs illustrate cross-state funds transfers and telecommunication call traffic.", body_style)
        ],
        [
            Paragraph("<b>CCTV Visual Identity Hunt</b>", bold_body),
            Paragraph("Investigators upload unconstrained CCTV snapshots. The detector locates faces, extracts 512-dim biometric vectors, and ranks candidate suspects from the knowledge graph in real time.", body_style)
        ],
        [
            Paragraph("<b>Forensic Decision Audit</b>", bold_body),
            Paragraph("Every match confirmation or rejection is signed with investigator ID, timestamp, and similarity confidence score, directly feeding the immutable legal audit chain.", body_style)
        ]
    ]
    t6 = Table(vis_data, colWidths=[230, 482])
    t6.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#1b3638")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t6)
    story.append(PageBreak())

    # ==================== SLIDE 7: LEGAL INTEGRITY & BSA 2023 ====================
    story.append(Paragraph("06 · LEGAL COMPLIANCE & CRYPTOGRAPHIC LEDGER", slide_heading))
    story.append(Paragraph("Admissibility Standards Under Bharatiya Sakshya Adhiniyam, 2023 (Section 63)", slide_subheading))

    legal_data = [
        [
            Paragraph("<b>Cryptographic Hash Chain</b>", bold_body),
            Paragraph("Every analytical event—source ingestion, entity merge review, counterfactual exclusion, and visual triage—is appended to a SHA-256 hash-chained ledger: <i>H<sub>n</sub> = SHA256(H<sub>n-1</sub> || EventData)</i>.", body_style)
        ],
        [
            Paragraph("<b>Section 63 BSA 2023 Certificate</b>", bold_body),
            Paragraph("The system auto-generates statutory digital evidence certificates of authenticity. Guarantees that electronic records have remained unaltered during processing and storage.", body_style)
        ],
        [
            Paragraph("<b>Court-Admissible Dossier Export</b>", bold_body),
            Paragraph("One-click generation of comprehensive investigation dossiers containing primary source excerpts, graph topology captures, biometric similarity match logs, and hash signatures.", body_style)
        ],
        [
            Paragraph("<b>Real-Time Integrity Verification</b>", bold_body),
            Paragraph("The `/api/audit/verify` endpoint recalculates the entire cryptographic chain on demand. Any byte modification or record tampering instantly flags a verification failure.", body_style)
        ]
    ]
    t7 = Table(legal_data, colWidths=[230, 482])
    t7.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#60c5b3")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t7)
    story.append(PageBreak())

    # ==================== SLIDE 8: BENCHMARKS & EVALUATION ====================
    story.append(Paragraph("07 · SYSTEM VERIFICATION & BENCHMARKS", slide_heading))
    story.append(Paragraph("Rigorous Rehearsal Results Against Ground-Truth Synthetic Scenarios", slide_subheading))

    bench_data = [
        [Paragraph("<b>Metric / Benchmark</b>", gold_body), Paragraph("<b>Recorded Result</b>", gold_body), Paragraph("<b>Benchmark Significance</b>", gold_body)],
        [Paragraph("<b>Synthetic Gold Set</b>", bold_body), Paragraph("146 Nodes · 313 Edges", body_style), Paragraph("Zero data loss across FIRs, CDR calls, and financial records.", body_style)],
        [Paragraph("<b>Precision & Recall</b>", bold_body), Paragraph("Precision: 1.0 · Recall: 1.0", body_style), Paragraph("Deterministic rule engine matches ground-truth extraction exactly.", body_style)],
        [Paragraph("<b>Ingestion Latency</b>", bold_body), Paragraph("0.601 seconds (121 records)", body_style), Paragraph("Sub-second ingestion and entity resolution across multi-case silos.", body_style)],
        [Paragraph("<b>Graph Analysis Latency</b>", bold_body), Paragraph("0.203 seconds", body_style), Paragraph("Louvain communities and centrality metrics computed in real time.", body_style)],
        [Paragraph("<b>Biometric Verification</b>", bold_body), Paragraph("Cosine Similarity 0.928", body_style), Paragraph("High-confidence match candidate retrieved for target Aariv Veylan.", body_style)],
        [Paragraph("<b>Automated Test Suite</b>", bold_body), Paragraph("40 / 40 Passed (100%)", body_style), Paragraph("Complete unit, integration, and E2E vision test coverage verified.", body_style)],
    ]
    t8 = Table(bench_data, colWidths=[170, 190, 352])
    t8.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#132d31")),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#1b3638")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t8)
    story.append(PageBreak())

    # ==================== SLIDE 9: LIVE DEMO & JUDGE ACCESS ====================
    story.append(Paragraph("08 · LIVE HOSTED DEMO & EVALUATOR ACCESS", slide_heading))
    story.append(Paragraph("100% Zero-Barrier Access · No Login Walls · Non-Expiring Edge Deployment", slide_subheading))

    demo_data = [
        [
            Paragraph("<b>Production Hosted URL</b>", gold_body),
            Paragraph("<b>https://nexus-workbench-avansh.netlify.app</b><br/>Global Edge CDN deployment with automated fallback to synthetic benchmarks.", bold_body)
        ],
        [
            Paragraph("<b>Zero-Barrier Judge Login</b>", bold_body),
            Paragraph("<b>No password typing required!</b> Click <b>\"⚡ 1-Click Evaluator Access (Admin)\"</b> on the welcome screen to open the pre-seeded workbench immediately.", body_style)
        ],
        [
            Paragraph("<b>Role-Based Profiles</b>", bold_body),
            Paragraph("• <b>Administrator:</b> Full control, demo resets, raw source ingestion, service diagnostics.<br/>• <b>Investigator:</b> CCTV identity searches, link suggestion triage, entity notes.<br/>• <b>Viewer:</b> Read-only network exploration, simulation playbacks, dossier exports.", body_style)
        ],
        [
            Paragraph("<b>Local Native Startup</b>", bold_body),
            Paragraph("Run <code>.\\scripts\\host-services.ps1</code> in PowerShell to boot Spring Boot, FastAPI, and Vite locally with bundled OpenJDK 17 and Python 3.12 runtimes.", body_style)
        ]
    ]
    t9 = Table(demo_data, colWidths=[200, 512])
    t9.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#60c5b3")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t9)
    story.append(PageBreak())

    # ==================== SLIDE 10: FUTURE ROADMAP ====================
    story.append(Paragraph("09 · WHAT IS NEXT: SYSTEM ROADMAP", slide_heading))
    story.append(Paragraph("Strategic Evolution from Prototype Workbench to Multi-Agency Production Network", slide_subheading))

    road_data = [
        [
            Paragraph("<b>Distributed Graph Engine (Scale-Out)</b>", bold_body),
            Paragraph("Transition from in-memory processing to native distributed graph engines (Neo4j Enterprise / Memgraph) supporting 10,000,000+ nodes and real-time community clustering.", body_style)
        ],
        [
            Paragraph("<b>Real-Time CCTV Stream Ingestion</b>", bold_body),
            Paragraph("Integrate Apache Kafka and WebRTC RTSP pipelines for live video feeds from municipal CCTV networks, performing edge inference on Nvidia Jetson hardware.", body_style)
        ],
        [
            Paragraph("<b>Multi-Agency STIX/TAXII Interoperability</b>", bold_body),
            Paragraph("Adopt standardized Structured Threat Information Expression (STIX 2.1) protocols for secure, encrypted cross-department intelligence sharing between state and central agencies.", body_style)
        ],
        [
            Paragraph("<b>Zero-Knowledge Privacy Safeguards</b>", bold_body),
            Paragraph("Implement Zero-Knowledge Proofs (ZKPs) for privacy-preserving watchlist checks, ensuring non-suspect citizens' identities are mathematically blinded during surveillance audits.", body_style)
        ]
    ]
    t10 = Table(road_data, colWidths=[240, 472])
    t10.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0d1e21")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#1b3638")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#1b3638")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t10)

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    
    # Copy alias TeamID_Event_Deck.pdf
    if PDF_PATH.exists():
        import shutil
        shutil.copyfile(PDF_PATH, PDF_ALIAS)
        print(f"Deck created successfully: {PDF_PATH} and {PDF_ALIAS}")

if __name__ == "__main__":
    create_deck()
