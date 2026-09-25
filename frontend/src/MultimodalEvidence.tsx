import { useState, useEffect, useRef, useCallback } from "react";
import {
  Layers,
  FileText,
  Headphones,
  Eye,
  Upload,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Tag,
  Clock,
  Database,
  Film,
  Camera,
  Info,
  Play,
  Pause,
  Plus,
  Volume2,
} from "lucide-react";
import { api, apiForm } from "./types";
import type {
  Graph,
  Session,
  EvidenceAsset,
  EvidenceItem,
  VisualSearchResponse,
  EvidenceReviewDecision,
} from "./types";

const WAVEFORM_BARS = [
  25, 42, 68, 85, 52, 34, 48, 76, 92, 88, 62, 44, 72, 96, 82, 64,
  38, 58, 74, 88, 92, 78, 42, 64, 82, 68, 48, 32, 54, 64, 42, 22
];

function formatAudioTime(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = (safe % 60).toFixed(1);
  return `${mins.toString().padStart(2, "0")}:${parseFloat(secs) < 10 ? "0" : ""}${secs}`;
}

function getEntityBox(item: EvidenceItem, index: number, _total: number) {
  if (item.provenance?.bbox && Array.isArray(item.provenance.bbox) && item.provenance.bbox.length === 4) {
    const [x, y, w, h] = item.provenance.bbox;
    return { x, y, width: w, height: h };
  }
  // Deterministic simulation layout across document page lines
  const row = (index % 6) + 2; // lines 2 to 7
  const col = index % 2; // 0 or 1
  const x = col === 0 ? 10 : 54;
  const y = row * 13 + 5;
  const width = Math.min(36, Math.max(20, (item.rawText?.length || 8) * 1.5));
  const height = 7.5;
  return { x, y, width, height };
}

function getEntityTypeColor(type?: string) {
  const t = (type || "").toUpperCase();
  if (t === "PERSON") return { stroke: "#10b981", fill: "rgba(16, 185, 129, 0.22)", text: "#34d399", label: "Person" };
  if (t === "PHONE") return { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.22)", text: "#fbbf24", label: "Phone" };
  if (t === "ACCOUNT") return { stroke: "#a855f7", fill: "rgba(168, 85, 247, 0.22)", text: "#c084fc", label: "Account" };
  if (t === "VEHICLE") return { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.22)", text: "#22d3ee", label: "Vehicle" };
  return { stroke: "#f43f5e", fill: "rgba(244, 63, 94, 0.22)", text: "#fb7185", label: "Location" };
}

interface MultimodalEvidenceProps {
  graph: Graph;
  session: Session;
  onNavigateToEntity?: (entityId: string) => void;
  onNavigateToCctvHunt?: (assetId: string) => void;
  onRefreshGraph?: () => Promise<unknown>;
}

export default function MultimodalEvidence({
  graph,
  session,
  onNavigateToEntity,
  onNavigateToCctvHunt,
  onRefreshGraph,
}: MultimodalEvidenceProps) {
  const canEdit = session.role !== "VIEWER";
  const [activeTab, setActiveTab] = useState<
    "repository" | "documents" | "audio" | "visual" | "reviews"
  >("repository");

  // Status & loading
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  // Asset Repository State
  const [assets, setAssets] = useState<EvidenceAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<EvidenceAsset | null>(null);
  const [assetItems, setAssetItems] = useState<EvidenceItem[]>([]);
  const [caseFilter, setCaseFilter] = useState<string>("All cases");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Ingestion Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaseId, setUploadCaseId] = useState<string>("NXS-007");
  const [uploadMediaType, setUploadMediaType] = useState<
    "DOCUMENT" | "AUDIO" | "IMAGE" | "VIDEO"
  >("DOCUMENT");
  const [uploadDescription, setUploadDescription] = useState<string>("");
  const [uploadAutoAnalyze, setUploadAutoAnalyze] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visual Search State
  const [visualQueryFile, setVisualQueryFile] = useState<File | null>(null);
  const [visualQueryPreview, setVisualQueryPreview] = useState<string | null>(null);
  const [visualQueryAssetId, setVisualQueryAssetId] = useState<string>("");
  const [visualThreshold, setVisualThreshold] = useState<number>(0.50);
  const [visualTopK, setVisualTopK] = useState<number>(10);
  const [visualResults, setVisualResults] = useState<VisualSearchResponse | null>(null);
  const visualInputRef = useRef<HTMLInputElement>(null);

  // Review Decisions State
  const [reviews, setReviews] = useState<EvidenceReviewDecision[]>([]);
  const [reviewNoteModalItem, setReviewNoteModalItem] = useState<EvidenceItem | null>(null);
  const [reviewDecisionChoice, setReviewDecisionChoice] = useState<
    "ACCEPTED" | "REJECTED" | "CORROBORATED"
  >("ACCEPTED");
  const [reviewNotes, setReviewNotes] = useState<string>("");

  // Sidecar Status State
  const [sidecarStatus, setSidecarStatus] = useState<Record<string, any> | null>(null);

  // Audio Playback & Waveform Simulation State
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0.0);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const audioIntervalRef = useRef<number | null>(null);

  // Document Bounding Box Canvas Hover State
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

  const audioDuration = (() => {
    const transcriptItem = assetItems.find((i) => i.itemType === "AUDIO_TRANSCRIPT");
    if (transcriptItem && (transcriptItem.timestampEnd ?? 0) > 0) return transcriptItem.timestampEnd!;
    const segments = assetItems.filter((i) => i.itemType === "AUDIO_SEGMENT");
    if (segments.length > 0) {
      const maxEnd = Math.max(...segments.map((s) => s.timestampEnd ?? 0));
      return maxEnd > 0 ? maxEnd : 8.5;
    }
    return 8.5;
  })();

  useEffect(() => {
    if (audioPlaying) {
      audioIntervalRef.current = window.setInterval(() => {
        setAudioCurrentTime((prev) => {
          const next = prev + 0.1 * audioSpeed;
          if (next >= audioDuration) {
            setAudioPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    } else if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
    }
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [audioPlaying, audioSpeed, audioDuration]);

  const activeSpeakerSegment = assetItems.find(
    (i) =>
      i.itemType === "AUDIO_SEGMENT" &&
      audioCurrentTime >= (i.timestampStart ?? 0) &&
      audioCurrentTime <= (i.timestampEnd ?? 9999)
  );

  const handlePromoteToGraph = async (item: EvidenceItem) => {
    const label = item.rawContent || item.rawText || "entity";
    setBusy(`Promoting ${label} to canonical graph with verified A1 provenance…`);
    setError("");
    setNotice("");
    try {
      await api<any>(`/evidence/promote?itemId=${encodeURIComponent(item.id)}&notes=Investigator corroborated lead via multimodal workbench`, {});
      setNotice(`Successfully promoted "${label}" into canonical graph with verified A1 provenance!`);
      await fetchReviews();
      if (onRefreshGraph) void onRefreshGraph();
    } catch (e: any) {
      setError(e.message || "Promotion to graph failed");
    } finally {
      setBusy("");
    }
  };

  const fetchAssets = useCallback(async () => {
    try {
      const list = await api<EvidenceAsset[]>("/evidence/assets");
      setAssets(list);
      if (!selectedAsset && list.length > 0) {
        setSelectedAsset(list[0]);
      }
    } catch (e: any) {
      // Graceful fallback if backend table is empty
      setAssets([]);
    }
  }, [selectedAsset]);

  const fetchReviews = useCallback(async () => {
    try {
      const list = await api<EvidenceReviewDecision[]>("/evidence/reviews");
      setReviews(list);
    } catch {
      setReviews([]);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await api<Record<string, any>>("/evidence/status");
      setSidecarStatus(status);
    } catch {
      setSidecarStatus({ sidecar: "offline", device: "cpu" });
    }
  }, []);

  useEffect(() => {
    void fetchAssets();
    void fetchReviews();
    void fetchStatus();
  }, [fetchAssets, fetchReviews, fetchStatus]);

  useEffect(() => {
    if (selectedAsset) {
      void api<EvidenceItem[]>(`/evidence/assets/${selectedAsset.id}/items`)
        .then(setAssetItems)
        .catch(() => setAssetItems([]));
    } else {
      setAssetItems([]);
    }
  }, [selectedAsset]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setError("Please select a file to upload.");
      return;
    }

    setBusy("Ingesting and hashing multimodal evidence asset…");
    setError("");
    setNotice("");

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("caseId", uploadCaseId);
      formData.append("mediaType", uploadMediaType);
      formData.append("description", uploadDescription);
      formData.append("autoAnalyze", String(uploadAutoAnalyze));

      const created = await apiForm<EvidenceAsset>("/evidence/upload", formData);
      setNotice(`Evidence Asset ${created.id} securely ingested (SHA-256: ${created.fileHash.slice(0, 12)}…)`);
      setUploadFile(null);
      setUploadDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchAssets();
      setSelectedAsset(created);

      // Auto route to view
      if (uploadMediaType === "DOCUMENT") setActiveTab("documents");
      else if (uploadMediaType === "AUDIO") setActiveTab("audio");
      else if (uploadMediaType === "IMAGE" || uploadMediaType === "VIDEO") setActiveTab("visual");
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setBusy("");
    }
  };

  const handleAnalyzeAsset = async (asset: EvidenceAsset) => {
    setBusy(`Analyzing ${asset.fileName} via neural sidecar…`);
    setError("");
    setNotice("");
    try {
      let endpoint = "";
      if (asset.mediaType === "DOCUMENT") endpoint = `/evidence/document/analyze?assetId=${asset.id}`;
      else if (asset.mediaType === "AUDIO") endpoint = `/evidence/audio/analyze?assetId=${asset.id}`;
      else endpoint = `/evidence/visual/embed?assetId=${asset.id}`;

      await api(endpoint, {});
      setNotice(`Successfully extracted machine intelligence for ${asset.id}`);
      await fetchAssets();
      const updatedItems = await api<EvidenceItem[]>(`/evidence/assets/${asset.id}/items`);
      setAssetItems(updatedItems);
      if (onRefreshGraph) void onRefreshGraph();
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setBusy("");
    }
  };

  const handleSeedDemo = async () => {
    setBusy("Seeding realistic multimodal evidence fixtures (FIR, Wiretap Audio, Seized Vehicles)…");
    setError("");
    setNotice("");
    try {
      const res = await api<Record<string, any>>("/evidence/demo/seed", {});
      setNotice(res.message || "Multimodal evidence fixtures loaded!");
      await fetchAssets();
      await fetchReviews();
      if (onRefreshGraph) void onRefreshGraph();
    } catch (e: any) {
      setError(e.message || "Failed to seed demo evidence");
    } finally {
      setBusy("");
    }
  };

  const handleRunVisualSearch = async () => {
    setBusy("Extracting OpenCLIP ViT-B-32 unit embedding and calculating cosine similarities…");
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      if (visualQueryFile) formData.append("queryFile", visualQueryFile);
      if (visualQueryAssetId) formData.append("queryAssetId", visualQueryAssetId);
      formData.append("threshold", String(visualThreshold));
      formData.append("topK", String(visualTopK));

      const resp = await apiForm<VisualSearchResponse>("/evidence/visual-search", formData);
      setVisualResults(resp);
      setNotice(`Identified ${resp.totalMatches} visual lead(s) exceeding ${Math.round(resp.threshold * 100)}% similarity`);
    } catch (e: any) {
      setError(e.message || "Visual search failed");
    } finally {
      setBusy("");
    }
  };

  const submitReviewDecision = async () => {
    if (!reviewNoteModalItem) return;
    setBusy("Recording cryptographic review decision…");
    try {
      await api<EvidenceReviewDecision>("/evidence/review", {
        itemId: reviewNoteModalItem.id,
        decision: reviewDecisionChoice,
        notes: reviewNotes,
      });
      setNotice(`Review recorded: ${reviewDecisionChoice} for ${reviewNoteModalItem.id}`);
      setReviewNoteModalItem(null);
      setReviewNotes("");
      await fetchReviews();
      if (selectedAsset) {
        const updated = await api<EvidenceItem[]>(`/evidence/assets/${selectedAsset.id}/items`);
        setAssetItems(updated);
      }
    } catch (e: any) {
      setError(e.message || "Review decision submission failed");
    } finally {
      setBusy("");
    }
  };

  // Filtered Assets
  const filteredAssets = assets.filter((a) => {
    if (caseFilter !== "All cases" && a.caseId !== caseFilter) return false;
    if (typeFilter !== "ALL" && a.mediaType !== typeFilter) return false;
    return true;
  });

  const availableCases = Array.from(new Set(["NXS-007", "CASE-019", ...assets.map((a) => a.caseId)]));

  return (
    <div className="multimodal-evidence-container p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-[#151c24] border border-[#233549] rounded-xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-teal-400 uppercase">
            <Layers size={15} />
            Multimodal Evidence Fusion Engine
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">
            Multimodal Intelligence Workbench
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mt-1">
            Unified ingestion and provenance-linked extraction for documents (PP-OCRv5), audio (faster-whisper), and visual evidence (OpenCLIP ViT-B-32). All machine findings are investigator-reviewable leads.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="button compact secondary text-xs font-medium bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-slate-700 px-3 py-2 rounded-lg flex items-center gap-2 transition"
            onClick={handleSeedDemo}
            disabled={!canEdit || !!busy}
            title="Seed demo fixtures: Scanned FIR, Wiretap audio, and cross-case vehicles"
          >
            <Database size={14} className="text-teal-400" />
            Seed Demo Multimodal Evidence
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {error && (
        <div className="bg-red-950/70 border border-red-800 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="bg-teal-950/70 border border-teal-800 text-teal-200 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-400 flex-shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice("")} className="text-teal-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {busy && (
        <div className="bg-sky-950/70 border border-sky-800 text-sky-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm animate-pulse">
          <RotateCcw size={16} className="animate-spin text-sky-400 flex-shrink-0" />
          <span>{busy}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#233549] pb-2">
        {[
          { id: "repository" as const, label: "Evidence Catalog & Ingest", icon: Upload, count: assets.length },
          { id: "documents" as const, label: "Document OCR (PP-OCRv5)", icon: FileText, count: assets.filter((a) => a.mediaType === "DOCUMENT").length },
          { id: "audio" as const, label: "Audio Intelligence (Whisper)", icon: Headphones, count: assets.filter((a) => a.mediaType === "AUDIO").length },
          { id: "visual" as const, label: "Visual Evidence Search (OpenCLIP)", icon: Eye, count: assets.filter((a) => a.mediaType === "IMAGE" || a.mediaType === "VIDEO").length },
          { id: "reviews" as const, label: "Investigator Review Log", icon: ShieldCheck, count: reviews.length },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition ${
                active
                  ? "bg-teal-700/30 text-teal-300 border border-teal-500 shadow-md"
                  : "bg-[#131922] text-slate-400 border border-transparent hover:bg-[#1a2330] hover:text-slate-200"
              }`}
            >
              <Icon size={15} className={active ? "text-teal-400" : "text-slate-500"} />
              <span>{t.label}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${active ? "bg-teal-900/60 text-teal-200" : "bg-slate-800 text-slate-400"}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EVIDENCE REPOSITORY & INGESTION                                    */}
      {/* ========================================================================= */}
      {activeTab === "repository" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Ingestion Panel */}
          <div className="lg:col-span-4 bg-[#141b24] border border-[#233549] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
              <Upload size={16} />
              <h2>Unified Evidence Ingestion</h2>
            </div>
            <p className="text-xs text-slate-400">
              Upload scanned FIRs, wiretap recordings, CCTV clips, or seized vehicle images. Computes SHA-256 fingerprint upon intake.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Source File (PDF, Audio, Image, Video)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  disabled={!canEdit || !!busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      // Guess type
                      const ext = f.name.split(".").pop()?.toLowerCase();
                      if (ext === "pdf" || ext === "txt") setUploadMediaType("DOCUMENT");
                      else if (["wav", "mp3", "m4a", "ogg"].includes(ext || "")) setUploadMediaType("AUDIO");
                      else if (["mp4", "avi", "mov", "mkv"].includes(ext || "")) setUploadMediaType("VIDEO");
                      else if (["jpg", "jpeg", "png", "webp", "tiff"].includes(ext || "")) setUploadMediaType("IMAGE");
                    }
                  }}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-700 file:text-white hover:file:bg-teal-600 bg-[#0e131a] border border-[#223347] rounded-lg p-2 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Case Identifier</label>
                  <input
                    type="text"
                    value={uploadCaseId}
                    onChange={(e) => setUploadCaseId(e.target.value)}
                    disabled={!canEdit || !!busy}
                    placeholder="e.g. NXS-007"
                    className="w-full bg-[#0e131a] border border-[#223347] rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Media Category</label>
                  <select
                    value={uploadMediaType}
                    onChange={(e) => setUploadMediaType(e.target.value as any)}
                    disabled={!canEdit || !!busy}
                    className="w-full bg-[#0e131a] border border-[#223347] rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="DOCUMENT">Document (PDF/Scanned FIR)</option>
                    <option value="AUDIO">Audio (Voice note / Call)</option>
                    <option value="IMAGE">Image (Scene / Vehicle)</option>
                    <option value="VIDEO">Video (CCTV / Surveillance)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description & Context</label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  disabled={!canEdit || !!busy}
                  placeholder="Seized items, chain of custody notes, location info…"
                  className="w-full bg-[#0e131a] border border-[#223347] rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoAnalyze"
                  checked={uploadAutoAnalyze}
                  onChange={(e) => setUploadAutoAnalyze(e.target.checked)}
                  disabled={!canEdit || !!busy}
                  className="rounded border-[#223347] text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="autoAnalyze" className="text-xs text-slate-300 cursor-pointer">
                  Auto-trigger neural sidecar analysis on ingest
                </label>
              </div>

              <button
                type="submit"
                disabled={!canEdit || !uploadFile || !!busy}
                className="w-full py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <Upload size={14} />
                Ingest & Process Evidence
              </button>
            </form>

            {/* Neural Sidecar Status */}
            <div className="mt-4 p-3 bg-[#0d141e] border border-[#1d2a3a] rounded-lg">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
                <span>NEURAL SIDECAR STATUS</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  ACTIVE
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 space-y-1">
                <div>OCR: <span className="text-teal-300">PP-OCRv5 (En, Hi, Mr)</span></div>
                <div>Audio: <span className="text-teal-300">faster-whisper small-int8</span></div>
                <div>Visual: <span className="text-teal-300">OpenCLIP ViT-B-32</span></div>
                <div>Hardware: <span className="text-slate-300 uppercase">{sidecarStatus?.device || "CPU"}</span></div>
              </div>
            </div>
          </div>

          {/* Asset List & Viewer */}
          <div className="lg:col-span-8 bg-[#141b24] border border-[#233549] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200">
                <Database size={16} className="text-teal-400" />
                <span>Ingested Multimodal Evidence Assets ({filteredAssets.length})</span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={caseFilter}
                  onChange={(e) => setCaseFilter(e.target.value)}
                  className="bg-[#0e131a] border border-[#223347] rounded-md px-2 py-1 text-xs text-slate-200"
                >
                  <option>All cases</option>
                  {availableCases.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-[#0e131a] border border-[#223347] rounded-md px-2 py-1 text-xs text-slate-200"
                >
                  <option value="ALL">All media</option>
                  <option value="DOCUMENT">Documents</option>
                  <option value="AUDIO">Audio</option>
                  <option value="IMAGE">Images</option>
                  <option value="VIDEO">Videos</option>
                </select>
              </div>
            </div>

            {/* Asset Table */}
            <div className="overflow-x-auto border border-[#233549] rounded-lg">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#101720] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#233549]">
                  <tr>
                    <th className="py-2.5 px-3">Asset ID</th>
                    <th className="py-2.5 px-3">Case</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">File Name</th>
                    <th className="py-2.5 px-3">SHA-256 Hash</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a3a]">
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">
                        No evidence assets found. Click "Seed Demo Multimodal Evidence" or upload an asset.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => {
                      const isSelected = selectedAsset?.id === asset.id;
                      return (
                        <tr
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className={`cursor-pointer transition hover:bg-[#1a2432] ${
                            isSelected ? "bg-teal-950/40 border-l-2 border-l-teal-500" : ""
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-teal-400">{asset.id}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                              {asset.caseId}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="flex items-center gap-1 text-[11px]">
                              {asset.mediaType === "DOCUMENT" && <FileText size={12} className="text-amber-400" />}
                              {asset.mediaType === "AUDIO" && <Headphones size={12} className="text-sky-400" />}
                              {asset.mediaType === "IMAGE" && <Camera size={12} className="text-rose-400" />}
                              {asset.mediaType === "VIDEO" && <Film size={12} className="text-purple-400" />}
                              {asset.mediaType}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-200 max-w-[140px] truncate" title={asset.fileName}>
                            {asset.fileName}
                          </td>
                          <td className="py-2 px-3 font-mono text-[10px] text-slate-400" title={asset.fileHash}>
                            {asset.fileHash ? `${asset.fileHash.slice(0, 10)}…` : "—"}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                asset.analysisStatus === "ANALYZED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : asset.analysisStatus === "FAILED"
                                  ? "bg-red-950 text-red-400 border border-red-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              {asset.analysisStatus}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {asset.analysisStatus !== "ANALYZED" && canEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleAnalyzeAsset(asset);
                                  }}
                                  className="px-2 py-0.5 bg-teal-800 hover:bg-teal-700 text-white rounded text-[11px] transition"
                                >
                                  Analyze
                                </button>
                              )}
                              {asset.mediaType === "VIDEO" && onNavigateToCctvHunt && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateToCctvHunt(asset.id);
                                  }}
                                  className="px-2 py-0.5 bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-700 rounded text-[11px] transition flex items-center gap-1 font-semibold"
                                  title="Open in Natural-Language CCTV Hunt"
                                >
                                  <Film size={11} />
                                  <span>Hunt</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAsset(asset);
                                  if (asset.mediaType === "DOCUMENT") setActiveTab("documents");
                                  else if (asset.mediaType === "AUDIO") setActiveTab("audio");
                                  else setActiveTab("visual");
                                }}
                                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Selected Asset Details */}
            {selectedAsset && (
              <div className="p-4 bg-[#0d141e] border border-[#233549] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                    <Info size={14} className="text-teal-400" />
                    <span>Inspection Details: {selectedAsset.fileName}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    Ingested: {new Date(selectedAsset.createdAt).toLocaleString()} by {selectedAsset.createdBy}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-[#141b24] rounded border border-[#233549]">
                    <div className="text-[10px] text-slate-500 uppercase">Case ID</div>
                    <div className="font-bold text-slate-200">{selectedAsset.caseId}</div>
                  </div>
                  <div className="p-2 bg-[#141b24] rounded border border-[#233549]">
                    <div className="text-[10px] text-slate-500 uppercase">File Size</div>
                    <div className="font-bold text-slate-200">{(selectedAsset.fileSize / 1024).toFixed(1)} KB</div>
                  </div>
                  <div className="p-2 bg-[#141b24] rounded border border-[#233549]">
                    <div className="text-[10px] text-slate-500 uppercase">Extracted Items</div>
                    <div className="font-bold text-teal-400">{assetItems.length} items</div>
                  </div>
                  <div className="p-2 bg-[#141b24] rounded border border-[#233549]">
                    <div className="text-[10px] text-slate-500 uppercase">Provenance</div>
                    <div className="font-bold text-slate-200 truncate">{selectedAsset.storagePath}</div>
                  </div>
                </div>

                {selectedAsset.metadata?.description && (
                  <p className="text-xs text-slate-300 italic bg-[#141b24] p-2 rounded border border-[#233549]">
                    "{selectedAsset.metadata.description}"
                  </p>
                )}

                {selectedAsset.mediaType === "VIDEO" && onNavigateToCctvHunt && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => onNavigateToCctvHunt(selectedAsset.id)}
                      className="button compact primary text-xs py-2 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center gap-2 font-semibold shadow-md"
                    >
                      <Film size={14} />
                      <span>Launch Natural-Language CCTV Hunt for this Video</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DOCUMENT OCR & FIR INTELLIGENCE (PP-OCRv5)                          */}
      {/* ========================================================================= */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="bg-[#141b24] border border-[#233549] rounded-xl p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <FileText size={16} />
                  <h2>Document OCR & Scanned FIR Intelligence (PaddleOCR PP-OCRv5)</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Processes scanned FIRs, affidavits, and police reports in English and Devanagari (Hindi/Marathi). Extracted text is fed directly into entity extraction with verbatim citations.
                </p>
              </div>

              {/* Document Asset Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Select Document:</span>
                <select
                  value={selectedAsset?.id || ""}
                  onChange={(e) => {
                    const found = assets.find((a) => a.id === e.target.value);
                    if (found) setSelectedAsset(found);
                  }}
                  className="bg-[#0e131a] border border-[#223347] rounded-md px-3 py-1.5 text-xs text-slate-200"
                >
                  {assets
                    .filter((a) => a.mediaType === "DOCUMENT")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} - {a.fileName} ({a.caseId})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {selectedAsset && selectedAsset.mediaType === "DOCUMENT" ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
                {/* Left Column: Interactive Document Canvas & Recognized OCR Text */}
                <div className="lg:col-span-6 space-y-4">
                  {/* SVG Document Page Canvas with Bounding Boxes */}
                  <div className="bg-[#0e131a] border border-[#233549] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText size={14} className="text-amber-400" />
                        Interactive Scanned Document Canvas (Bounding Box Overlay)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                        Page 1 of 1
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Hover over any recognized bounding box or entity card to cross-reference location on the evidentiary document sheet.
                    </p>

                    <div className="relative bg-[#0b1017] rounded-lg border border-[#1e2a3a] p-2 flex justify-center items-center overflow-hidden">
                      <svg
                        viewBox="0 0 100 120"
                        className="w-full max-w-[420px] h-auto rounded shadow-2xl select-none"
                        style={{ background: "linear-gradient(180deg, #131b26 0%, #0d131c 100%)" }}
                      >
                        {/* Document Header Decorator */}
                        <rect x="6" y="6" width="88" height="108" rx="2" fill="none" stroke="#233549" strokeWidth="0.8" />
                        <rect x="9" y="9" width="82" height="14" rx="1.5" fill="#182332" />
                        <text x="50" y="15" fill="#94a3b8" fontSize="3.2" fontWeight="bold" textAnchor="middle" letterSpacing="0.3">
                          OFFICIAL POLICE INCIDENT REPORT / SCANNED FIR
                        </text>
                        <text x="50" y="19.5" fill="#64748b" fontSize="2.1" textAnchor="middle">
                          Case Reference: {selectedAsset.caseId} • Ingested: {selectedAsset.fileName}
                        </text>

                        {/* Faint document lines representing body text */}
                        {[27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 93, 99].map((ly) => (
                          <line key={ly} x1="12" y1={ly} x2="88" y2={ly} stroke="#1b2736" strokeWidth="0.6" strokeDasharray="2, 1" />
                        ))}

                        {/* Render Bounding Boxes for Extracted Entities */}
                        {assetItems
                          .filter((i) => i.itemType === "EXTRACTED_ENTITY")
                          .map((item, idx, arr) => {
                            const box = getEntityBox(item, idx, arr.length);
                            const style = getEntityTypeColor(item.provenance?.entityType);
                            const isHovered = hoveredEntityId === item.id;

                            return (
                              <g
                                key={item.id}
                                className="cursor-pointer transition-all duration-150"
                                onMouseEnter={() => setHoveredEntityId(item.id)}
                                onMouseLeave={() => setHoveredEntityId(null)}
                                onClick={() => {
                                  if (onNavigateToEntity) {
                                    const match = graph.nodes.find(
                                      (n) => n.label.toLowerCase() === item.rawText?.toLowerCase() || n.id === item.rawText
                                    );
                                    if (match) onNavigateToEntity(match.id);
                                  }
                                }}
                              >
                                <rect
                                  x={box.x}
                                  y={box.y}
                                  width={box.width}
                                  height={box.height}
                                  rx="1"
                                  fill={isHovered ? style.fill.replace("0.22", "0.45") : style.fill}
                                  stroke={isHovered ? "#ffffff" : style.stroke}
                                  strokeWidth={isHovered ? "1.2" : "0.7"}
                                  strokeDasharray={isHovered ? "none" : "1, 0.5"}
                                />
                                <text
                                  x={box.x + 1.2}
                                  y={box.y + 4.8}
                                  fill={isHovered ? "#ffffff" : style.text}
                                  fontSize="2.8"
                                  fontWeight={isHovered ? "bold" : "normal"}
                                >
                                  {item.rawText && item.rawText.length > 18 ? `${item.rawText.slice(0, 16)}…` : item.rawText}
                                </text>
                                {isHovered && (
                                  <g>
                                    <rect
                                      x={Math.max(4, Math.min(65, box.x))}
                                      y={Math.max(4, box.y - 7)}
                                      width="32"
                                      height="6"
                                      rx="1"
                                      fill="#020617"
                                      stroke="#38bdf8"
                                      strokeWidth="0.6"
                                    />
                                    <text
                                      x={Math.max(4, Math.min(65, box.x)) + 16}
                                      y={Math.max(4, box.y - 7) + 4.2}
                                      fill="#38bdf8"
                                      fontSize="2.4"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                    >
                                      {style.label} • {Math.round(item.confidence * 100)}% conf
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          })}
                      </svg>
                    </div>

                    {/* Canvas Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-400" />
                        Person
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-400" />
                        Phone
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/40 border border-purple-400" />
                        Account
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/40 border border-cyan-400" />
                        Vehicle
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/40 border border-rose-400" />
                        Location
                      </span>
                    </div>
                  </div>

                  {/* Document Information & Raw Text */}
                  <div className="bg-[#0e131a] border border-[#233549] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                        OCR Recognized Document Text
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-teal-900/60 text-teal-300 font-mono">
                        Model: PaddleOCR PP-OCRv5
                      </span>
                    </div>

                    <div className="bg-[#141c26] p-3 rounded border border-[#1e2a3a] text-xs font-mono text-slate-300 max-h-56 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                      {assetItems.find((i) => i.itemType === "DOCUMENT_PAGE")?.rawText ||
                        "No OCR text extracted yet. Click 'Analyze Document' below to run PP-OCRv5."}
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleAnalyzeAsset(selectedAsset)}
                        disabled={!!busy}
                        className="button compact primary w-full text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-2"
                      >
                        <Sparkles size={14} />
                        Run / Re-run PaddleOCR Extraction
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Column: Extracted Entities with Verbatim Citations & Canonical Graph Promotion */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="bg-[#0e131a] border border-[#233549] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                        Evidence-Linked Extracted Entities
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {assetItems.filter((i) => i.itemType === "EXTRACTED_ENTITY").length} entities detected
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
                      {assetItems.filter((i) => i.itemType === "EXTRACTED_ENTITY").length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No entities extracted yet.
                        </div>
                      ) : (
                        assetItems
                          .filter((i) => i.itemType === "EXTRACTED_ENTITY")
                          .map((item) => {
                            const entType = item.provenance?.entityType || "Entity";
                            const decision = reviews.find((r) => r.itemId === item.id);
                            const isHovered = hoveredEntityId === item.id;
                            const isCorroborated = decision?.decision === "CORROBORATED";

                            return (
                              <div
                                key={item.id}
                                onMouseEnter={() => setHoveredEntityId(item.id)}
                                onMouseLeave={() => setHoveredEntityId(null)}
                                className={`p-3 bg-[#141c26] border rounded-lg space-y-2 transition-all duration-150 ${
                                  isHovered
                                    ? "border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)] bg-[#192433]"
                                    : "border-[#233549] hover:border-slate-600"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-900/60 text-amber-300">
                                      {entType}
                                    </span>
                                    <span
                                      className="text-xs font-bold text-white cursor-pointer hover:underline"
                                      onClick={() => {
                                        if (onNavigateToEntity) {
                                          const match = graph.nodes.find(
                                            (n) => n.label.toLowerCase() === item.rawText?.toLowerCase() || n.id === item.rawText
                                          );
                                          if (match) onNavigateToEntity(match.id);
                                        }
                                      }}
                                      title="Click to view entity in relational graph"
                                    >
                                      {item.rawText}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Conf: {Math.round(item.confidence * 100)}%
                                  </span>
                                </div>

                                {item.provenance?.citation && (
                                  <div className="text-[11px] text-slate-400 italic bg-[#0e131a] p-2 rounded border border-[#1e2a3a]">
                                    Citation: "{item.provenance.citation}"
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="text-slate-500">Status:</span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-semibold ${
                                        decision?.decision === "ACCEPTED"
                                          ? "bg-emerald-950 text-emerald-300"
                                          : decision?.decision === "REJECTED"
                                          ? "bg-red-950 text-red-300"
                                          : decision?.decision === "CORROBORATED"
                                          ? "bg-sky-950 text-sky-300"
                                          : "bg-slate-800 text-slate-400"
                                      }`}
                                    >
                                      {decision ? decision.decision : "PENDING_REVIEW"}
                                    </span>
                                  </div>

                                  {canEdit && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void handlePromoteToGraph(item)}
                                        disabled={!!busy}
                                        title="Promote verified lead directly to canonical graph with verified A1 provenance"
                                        className={`px-2 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 shadow-sm ${
                                          isCorroborated
                                            ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-800/80"
                                            : "bg-teal-900/80 hover:bg-teal-800 text-teal-200 border border-teal-700/60"
                                        }`}
                                      >
                                        <Plus size={11} />
                                        {isCorroborated ? "Re-Promote" : "Promote to Graph"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReviewNoteModalItem(item);
                                          setReviewDecisionChoice("ACCEPTED");
                                          setReviewNotes(decision?.notes || "");
                                        }}
                                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition"
                                      >
                                        Review Lead
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 bg-[#0e131a] rounded-lg">
                No document evidence selected. Choose a document above or seed demo fixtures.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIO & VOICE INTELLIGENCE (faster-whisper)                         */}
      {/* ========================================================================= */}
      {activeTab === "audio" && (
        <div className="space-y-6">
          <div className="bg-[#141b24] border border-[#233549] rounded-xl p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                  <Headphones size={16} />
                  <h2>Audio & Voice Intelligence (faster-whisper small-int8)</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Multilingual transcription with timestamped segments and anonymous speaker diarization (SPEAKER_00, SPEAKER_01). Extracted entities are tied directly to call timestamps.
                </p>
              </div>

              {/* Audio Asset Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Select Recording:</span>
                <select
                  value={selectedAsset?.id || ""}
                  onChange={(e) => {
                    const found = assets.find((a) => a.id === e.target.value);
                    if (found) setSelectedAsset(found);
                  }}
                  className="bg-[#0e131a] border border-[#223347] rounded-md px-3 py-1.5 text-xs text-slate-200"
                >
                  {assets
                    .filter((a) => a.mediaType === "AUDIO")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} - {a.fileName} ({a.caseId})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {selectedAsset && selectedAsset.mediaType === "AUDIO" ? (
              <div className="space-y-6 mt-4">
                {/* Full Transcript Summary Card */}
                <div className="p-4 bg-[#0e131a] border border-[#233549] rounded-lg space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      Full Wiretap Transcript & Audio Provenance
                    </span>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                        Language: {selectedAsset.metadata?.detectedLanguage || "hi / en"}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Diarization: PyAnnote Community Fallback
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-mono text-slate-300 bg-[#141c26] p-3 rounded border border-[#1e2a3a] leading-relaxed whitespace-pre-wrap">
                    {assetItems.find((i) => i.itemType === "AUDIO_TRANSCRIPT")?.rawText ||
                      "No transcript available. Click 'Analyze Audio' to run faster-whisper transcription."}
                  </p>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleAnalyzeAsset(selectedAsset)}
                      disabled={!!busy}
                      className="button compact primary text-xs font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} />
                      Run faster-whisper Transcription & Diarization
                    </button>
                  )}
                </div>

                {/* Synchronized Wiretap Player & 32-Bar Visual Audio Waveform Scrubber */}
                <div className="p-4 bg-[#0e131a] border border-[#233549] rounded-lg space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Volume2 size={15} className="text-sky-400" />
                      Synchronized Wiretap Player & 32-Bar Visual Waveform Scrubber
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-sky-400 font-bold">
                        {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
                      </span>
                      {activeSpeakerSegment && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-700 animate-pulse">
                          {activeSpeakerSegment.speaker || "SPEAKER_00"} ACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 32-Bar Interactive Waveform Scrubber */}
                  <div
                    className="relative h-20 bg-[#0a0f16] rounded-lg p-2.5 flex items-end justify-between gap-1 border border-[#1e2a3a] cursor-pointer group select-none"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      setAudioCurrentTime(clickRatio * audioDuration);
                    }}
                    title="Click anywhere to scrub audio playback position"
                  >
                    {WAVEFORM_BARS.map((heightPercent, idx) => {
                      const barProgress = idx / 32;
                      const currentProgress = audioDuration > 0 ? audioCurrentTime / audioDuration : 0;
                      const isPassed = barProgress <= currentProgress;
                      return (
                        <div
                          key={idx}
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-sm transition-all duration-75 ${
                            isPassed
                              ? "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]"
                              : "bg-[#1e2d3d] group-hover:bg-[#2a3c50]"
                          }`}
                        />
                      );
                    })}

                    {/* Scrubber Needle Cursor */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] pointer-events-none transition-all duration-75"
                      style={{
                        left: `${Math.max(0, Math.min(100, (audioDuration > 0 ? audioCurrentTime / audioDuration : 0) * 100))}%`,
                      }}
                    >
                      <div className="w-2.5 h-2.5 bg-amber-400 rounded-full -ml-1 -mt-1 shadow-md" />
                    </div>
                  </div>

                  {/* Playback Controls Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAudioPlaying((p) => !p)}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-md"
                      >
                        {audioPlaying ? <Pause size={13} /> : <Play size={13} />}
                        {audioPlaying ? "Pause Audio" : "Play Wiretap"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAudioPlaying(false);
                          setAudioCurrentTime(0);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition flex items-center gap-1"
                        title="Reset to beginning"
                      >
                        <RotateCcw size={12} />
                        Reset
                      </button>
                    </div>

                    {/* Playback Speed Controls */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>Speed:</span>
                      {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => setAudioSpeed(speed)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                            audioSpeed === speed
                              ? "bg-teal-800 text-teal-200 border border-teal-600 font-bold"
                              : "bg-[#141c26] text-slate-400 hover:text-slate-200 border border-[#233549]"
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Diarized Segments List */}
                <div className="p-4 bg-[#0e131a] border border-[#233549] rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      Timestamped Speaker Segments & Extracted Telephony Entities
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {assetItems.filter((i) => i.itemType === "AUDIO_SEGMENT").length} segments identified
                    </span>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {assetItems.filter((i) => i.itemType === "AUDIO_SEGMENT").length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No timestamped segments available. Run audio analysis to generate diarization.
                      </div>
                    ) : (
                      assetItems
                        .filter((i) => i.itemType === "AUDIO_SEGMENT")
                        .map((seg) => {
                          const startSec = (seg.timestampStart ?? 0).toFixed(2);
                          const endSec = (seg.timestampEnd ?? 0).toFixed(2);
                          const isSegActive = activeSpeakerSegment?.id === seg.id;
                          const entitiesInSeg = assetItems.filter(
                            (it) =>
                              it.itemType === "EXTRACTED_ENTITY" &&
                              it.speaker === seg.speaker &&
                              (it.timestampStart ?? 0) >= (seg.timestampStart ?? 0) - 0.5 &&
                              (it.timestampEnd ?? 0) <= (seg.timestampEnd ?? 0) + 0.5
                          );

                          return (
                            <div
                              key={seg.id}
                              onClick={() => {
                                setAudioCurrentTime(seg.timestampStart ?? 0);
                                setAudioPlaying(true);
                              }}
                              className={`p-3 bg-[#141c26] border rounded-lg space-y-2 cursor-pointer transition-all duration-150 ${
                                isSegActive
                                  ? "border-sky-400 bg-sky-950/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                                  : "border-[#233549] hover:border-slate-600"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    isSegActive
                                      ? "bg-sky-700 text-white animate-pulse"
                                      : "bg-sky-900/60 text-sky-300"
                                  }`}>
                                    {seg.speaker || "SPEAKER_00"}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                    <Clock size={11} /> {startSec}s – {endSec}s
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">ID: {seg.id}</span>
                              </div>

                              <p className="text-xs text-slate-200 font-mono pl-1">
                                "{seg.rawText}"
                              </p>

                              {/* Highlighted extracted entities in this segment */}
                              {entitiesInSeg.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {entitiesInSeg.map((e) => (
                                    <div
                                      key={e.id}
                                      className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded font-mono text-[10px]"
                                    >
                                      <span className="text-amber-300 flex items-center gap-1">
                                        <Tag size={10} />
                                        {e.provenance?.entityType}: <strong>{e.rawText}</strong>
                                      </span>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={(evt) => {
                                            evt.stopPropagation();
                                            void handlePromoteToGraph(e);
                                          }}
                                          disabled={!!busy}
                                          title="Promote verified telephony lead to canonical graph"
                                          className="ml-1 px-1.5 py-0.5 rounded bg-teal-800 hover:bg-teal-700 text-teal-200 font-sans text-[9px] transition flex items-center gap-0.5"
                                        >
                                          <Plus size={9} />
                                          Promote
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 bg-[#0e131a] rounded-lg">
                No audio recording selected. Choose an audio asset above or seed demo fixtures.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: VISUAL EVIDENCE SEARCH (OpenCLIP ViT-B-32)                          */}
      {/* ========================================================================= */}
      {activeTab === "visual" && (
        <div className="space-y-6">
          <div className="bg-[#141b24] border border-[#233549] rounded-xl p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <Eye size={16} />
                <h2>Visual Evidence Search (OpenCLIP ViT-B-32 / laion2b_s34b_b79k)</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Compares evidence photos and CCTV video frames across cases using 512-dimensional normalized unit embeddings. Video streams are automatically sampled every ~2 seconds (safe max 20).
              </p>
            </div>

            {/* MANDATORY INVESTIGATIVE LEAD DISCLAIMER BANNER */}
            <div className="p-3.5 bg-amber-950/40 border border-amber-700/60 rounded-lg text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong>INVESTIGATIVE LEAD SAFEGUARD:</strong> Visual similarity indicates an analytical lead only. It does not establish physical identity, vehicle ownership, or case connection, and must never silently merge identities or create legal facts without investigator review.
              </div>
            </div>

            {/* Search Input Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#0e131a] border border-[#233549] rounded-lg p-4">
              {/* Probe Selector */}
              <div className="lg:col-span-6 space-y-3">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                  1. Provide Visual Query Probe
                </span>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Upload Probe Photo / Frame:
                  </label>
                  <input
                    type="file"
                    ref={visualInputRef}
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setVisualQueryFile(file);
                        setVisualQueryAssetId("");
                        const url = URL.createObjectURL(file);
                        setVisualQueryPreview(url);
                      }
                    }}
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-rose-700 file:text-white hover:file:bg-rose-600 bg-[#141c26] border border-[#223347] rounded-lg p-1.5 cursor-pointer"
                  />
                </div>

                <div className="text-center text-xs text-slate-500 font-bold">— OR SELECT ENROLLED ASSET —</div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Select Existing Enrolled Evidence Asset:
                  </label>
                  <select
                    value={visualQueryAssetId}
                    onChange={(e) => {
                      setVisualQueryAssetId(e.target.value);
                      setVisualQueryFile(null);
                      setVisualQueryPreview(null);
                    }}
                    className="w-full bg-[#141c26] border border-[#223347] rounded-md px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">Choose an enrolled photo or CCTV probe…</option>
                    {assets
                      .filter((a) => a.mediaType === "IMAGE" || a.mediaType === "VIDEO")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.id} - {a.fileName} ({a.caseId})
                        </option>
                      ))}
                  </select>
                </div>

                {visualQueryPreview && (
                  <div className="mt-2 p-2 bg-[#141c26] rounded border border-[#233549] flex items-center gap-3">
                    <img
                      src={visualQueryPreview}
                      alt="Query Probe"
                      className="w-20 h-16 object-cover rounded border border-slate-700"
                    />
                    <div className="text-xs text-slate-300 font-mono">
                      Query Image Loaded: {visualQueryFile?.name}
                    </div>
                  </div>
                )}
              </div>

              {/* Threshold & Top-K Controls */}
              <div className="lg:col-span-6 space-y-4">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                  2. Search Parameters & Execution
                </span>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Cosine Similarity Threshold:</span>
                    <span className="font-mono text-teal-400 font-bold">{Math.round(visualThreshold * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.30"
                    max="0.95"
                    step="0.05"
                    value={visualThreshold}
                    onChange={(e) => setVisualThreshold(parseFloat(e.target.value))}
                    className="w-full accent-teal-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>30% (Broad Leads)</span>
                    <span>50% (Default)</span>
                    <span>95% (Near-Duplicate)</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-1/2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Max Candidates (Top-K)</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={visualTopK}
                      onChange={(e) => setVisualTopK(parseInt(e.target.value) || 10)}
                      className="w-full bg-[#141c26] border border-[#223347] rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div className="w-1/2 pt-5">
                    <button
                      type="button"
                      onClick={handleRunVisualSearch}
                      disabled={(!visualQueryFile && !visualQueryAssetId) || !!busy}
                      className="w-full py-2 px-3 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-md"
                    >
                      <Search size={14} />
                      Find Cross-Case Matches
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Search Results */}
            {visualResults && (
              <div className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={14} className="text-teal-400" />
                    Ranked Cross-Case Visual Leads ({visualResults.matches.length})
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Threshold: ≥ {Math.round(visualResults.threshold * 100)}%
                  </span>
                </div>

                {visualResults.matches.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-[#0e131a] rounded-lg border border-[#233549]">
                    No visual items exceeded the {Math.round(visualResults.threshold * 100)}% similarity threshold across enrolled cases. Try lowering the threshold slider.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visualResults.matches.map((lead, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0e131a] border border-[#233549] rounded-xl p-4 space-y-3 hover:border-teal-500/60 transition shadow-lg"
                      >
                        {/* Match Title & Badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-teal-300">
                            {lead.similarityDisplay}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800 text-[10px] font-bold">
                            {lead.similarityScore}% SIMILARITY
                          </span>
                        </div>

                        {/* Thumbnail & Metadata */}
                        <div className="flex gap-3 items-center">
                          {lead.thumbnail ? (
                            <img
                              src={lead.thumbnail}
                              alt="Matched Evidence"
                              className="w-24 h-20 object-cover rounded-lg border border-slate-700 bg-slate-900 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-24 h-20 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 text-xs">
                              No preview
                            </div>
                          )}

                          <div className="text-xs space-y-1 text-slate-300 font-mono">
                            <div>Case: <strong className="text-amber-300">{lead.matchCaseId}</strong></div>
                            <div>Asset: <span className="text-slate-400">{lead.matchAssetId}</span></div>
                            <div>Frame: <span className="text-slate-400">#{lead.matchFrameIndex}</span></div>
                            <div>Time: <span className="text-slate-400">{lead.matchTimestamp.toFixed(1)}s</span></div>
                          </div>
                        </div>

                        {/* Non-accusatory disclaimer label */}
                        <div className="text-[10px] text-amber-300/90 italic bg-amber-950/30 p-2 rounded border border-amber-900/40">
                          {lead.leadDisclaimer}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: INVESTIGATOR REVIEW LOG & BSA DECISIONS                             */}
      {/* ========================================================================= */}
      {activeTab === "reviews" && (
        <div className="bg-[#141b24] border border-[#233549] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <ShieldCheck size={16} />
                <h2>Investigator Human-in-the-Loop Review Log</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Every machine-derived finding requires investigator acceptance, rejection, or corroboration before incorporation into court-ready dossiers.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs">
              {reviews.length} Recorded Review Decisions
            </span>
          </div>

          <div className="overflow-x-auto border border-[#233549] rounded-lg">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#101720] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#233549]">
                <tr>
                  <th className="py-2.5 px-3">Decision ID</th>
                  <th className="py-2.5 px-3">Evidence Item ID</th>
                  <th className="py-2.5 px-3">Investigative Determination</th>
                  <th className="py-2.5 px-3">Reviewed By</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Investigator Notes & Corroboration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a3a]">
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No review decisions recorded yet. Review machine-derived entities in the Document or Audio tabs.
                    </td>
                  </tr>
                ) : (
                  reviews.map((r) => (
                    <tr key={r.id} className="hover:bg-[#1a2432] transition">
                      <td className="py-2 px-3 font-mono font-bold text-teal-400">{r.id}</td>
                      <td className="py-2 px-3 font-mono text-slate-300">{r.itemId}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            r.decision === "ACCEPTED"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : r.decision === "REJECTED"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : "bg-sky-950 text-sky-400 border border-sky-800"
                          }`}
                        >
                          {r.decision}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-200">{r.reviewedBy}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-400">
                        {new Date(r.reviewedAt).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-slate-300 italic max-w-xs truncate" title={r.notes}>
                        "{r.notes || "No notes provided"}"
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal Dialog */}
      {reviewNoteModalItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141b24] border border-[#233549] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#233549] pb-3">
              <span className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <ShieldCheck size={16} className="text-teal-400" />
                Record Investigator Determination
              </span>
              <button
                type="button"
                onClick={() => setReviewNoteModalItem(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-[#0e131a] rounded border border-[#233549]">
                <div className="text-[10px] text-slate-500 uppercase">Item ID & Target</div>
                <div className="font-bold text-white font-mono">{reviewNoteModalItem.id}</div>
                <div className="text-slate-300 mt-1 font-mono">Value: "{reviewNoteModalItem.rawText}"</div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Determination:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["ACCEPTED", "REJECTED", "CORROBORATED"] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setReviewDecisionChoice(choice)}
                      className={`py-1.5 px-2 rounded text-xs font-semibold border transition ${
                        reviewDecisionChoice === choice
                          ? "bg-teal-700 text-white border-teal-500"
                          : "bg-[#0e131a] text-slate-400 border-[#233549] hover:bg-[#1a2330]"
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Investigator Reasoning / Corroboration:</label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Corroborated with bank records and physical surveillance report…"
                  className="w-full bg-[#0e131a] border border-[#233549] rounded-md p-2 text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#233549]">
              <button
                type="button"
                onClick={() => setReviewNoteModalItem(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReviewDecision}
                className="px-4 py-1.5 rounded-lg bg-teal-600 text-white font-semibold text-xs hover:bg-teal-500 transition"
              >
                Commit Determination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
