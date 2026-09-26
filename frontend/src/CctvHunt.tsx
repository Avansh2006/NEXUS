import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Video,
  Search,
  Play,
  Pause,
  RotateCcw,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Sparkles,
  Layers,
  Clock,
  Eye,
  Crosshair,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Cpu,
  FileCheck,
  Film,
} from "lucide-react";
import { api, apiForm, apiRaw } from "./types";
import type {
  Graph,
  Session,
  EvidenceAsset,
  CctvTrack,
  CctvAnalysis,
  CctvSearchResponse,
  VisualSearchResponse,
  EvidenceReviewDecision,
} from "./types";

interface CctvHuntProps {
  graph: Graph;
  session: Session;
  initialAssetId?: string;
  onNavigateToEntity?: (entityId: string) => void;
  onNavigateToMultimodal?: () => void;
}

interface CctvEngineStatus {
  status: string;
  dino_model?: string;
  sam_model?: string;
  device?: string;
  pipeline_mode?: string;
  default_sample_fps?: number;
  reground_interval_frames?: number;
  max_video_duration_seconds?: number;
}

const SUGGESTED_QUERIES = [
  { label: "white SUV", type: "Vehicle", desc: "Open-vocabulary detection for getaway / transit vehicles" },
  { label: "red motorcycle", type: "Vehicle", desc: "Two-wheeler detection for quick courier / scout movements" },
  { label: "person with red backpack", type: "Compound", desc: "Multi-concept association: person + red backpack proximity" },
  { label: "person carrying black bag", type: "Compound", desc: "Luggage / haversack courier pattern detection" },
  { label: "blue sedan", type: "Vehicle", desc: "Target passenger automobile search" },
  { label: "person in black jacket", type: "Person", desc: "Attire and garment visual search" },
];

export default function CctvHunt({
  graph: _graph,
  session,
  initialAssetId,
  onNavigateToEntity,
  onNavigateToMultimodal,
}: CctvHuntProps) {
  const canEdit = session.role !== "VIEWER";

  // Assets & Status State
  const [assets, setAssets] = useState<EvidenceAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<EvidenceAsset | null>(null);
  const [engineStatus, setEngineStatus] = useState<CctvEngineStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(false);

  // Search Parameters
  const [query, setQuery] = useState<string>("white SUV");
  const [boxThreshold, setBoxThreshold] = useState<number>(0.35);
  const [textThreshold, setTextThreshold] = useState<number>(0.25);
  const [regroundInterval, setRegroundInterval] = useState<number>(30);
  const [sampleFps, setSampleFps] = useState<number>(2.0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Search Execution & Progress
  const [searching, setSearching] = useState<boolean>(false);
  const [searchStage, setSearchStage] = useState<string>("");
  const [searchResult, setSearchResult] = useState<CctvSearchResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  // Video Player & Playback Synchronization
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(false);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(0);
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Selected Track Focus
  const [activeTrack, setActiveTrack] = useState<CctvTrack | null>(null);

  // Past Analyses for Selected Asset
  const [pastAnalyses, setPastAnalyses] = useState<CctvAnalysis[]>([]);
  const [selectedPastAnalysisId, setSelectedPastAnalysisId] = useState<string>("");

  // Cross-Case Visual Search Lead Modal
  const [similarModal, setSimilarModal] = useState<{
    open: boolean;
    loading: boolean;
    track: CctvTrack | null;
    result: VisualSearchResponse | null;
    error: string;
  }>({
    open: false,
    loading: false,
    track: null,
    result: null,
    error: "",
  });

  // Investigator Lead Review Modal
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    track: CctvTrack | null;
    decision: "ACCEPTED" | "REJECTED" | "CORROBORATED";
    notes: string;
    submitting: boolean;
    result: EvidenceReviewDecision | null;
    error: string;
  }>({
    open: false,
    track: null,
    decision: "ACCEPTED",
    notes: "",
    submitting: false,
    result: null,
    error: "",
  });

  // Upload Modal / State
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaseId, setUploadCaseId] = useState<string>("NXS-007");
  const [uploadDescription, setUploadDescription] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Fetch Engine Status
  const fetchEngineStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const s = await api<CctvEngineStatus>("/cctv/status");
      setEngineStatus(s);
    } catch {
      setEngineStatus({
        status: "OFFLINE",
        pipeline_mode: "fallback_cv_heuristic",
        dino_model: "IDEA-Research/grounding-dino-tiny",
        sam_model: "facebook/sam2-hiera-tiny",
        device: "cpu",
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // 2. Fetch Evidence Assets (filter for video)
  const fetchAssets = useCallback(async () => {
    try {
      const all = await api<EvidenceAsset[]>("/evidence/assets");
      const safeAll = Array.isArray(all) ? all : [];
      const videoAssets = safeAll.filter((a) => a.mediaType === "VIDEO" || a.fileName.toLowerCase().endsWith(".mp4") || a.fileName.toLowerCase().endsWith(".mov") || a.fileName.toLowerCase().endsWith(".avi"));
      setAssets(videoAssets);

      if (videoAssets.length > 0) {
        if (initialAssetId) {
          const matched = videoAssets.find((a) => a.id === initialAssetId);
          setSelectedAsset(matched || videoAssets[0]);
        } else if (!selectedAsset) {
          setSelectedAsset(videoAssets[0]);
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to load evidence assets");
    }
  }, [initialAssetId, selectedAsset]);

  // 3. Load past analyses for selected asset
  const fetchPastAnalyses = useCallback(async (assetId: string) => {
    try {
      const list = await api<CctvAnalysis[]>(`/cctv/analyses?assetId=${assetId}`);
      setPastAnalyses(Array.isArray(list) ? list : []);
    } catch {
      setPastAnalyses([]);
    }
  }, []);

  // 4. Load video stream blob for selected asset
  useEffect(() => {
    if (!selectedAsset) {
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
      setVideoLoaded(false);
      return;
    }

    let isMounted = true;
    let createdUrl: string | null = null;

    const loadVideoBlob = async () => {
      try {
        const resp = await apiRaw(`/evidence/assets/${selectedAsset.id}/file`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (isMounted) {
          createdUrl = URL.createObjectURL(blob);
          setVideoBlobUrl(createdUrl);
          setVideoLoaded(false);
        }
      } catch {
        // Fallback or error handled gracefully
      }
    };

    loadVideoBlob();
    fetchPastAnalyses(selectedAsset.id);

    return () => {
      isMounted = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [selectedAsset, fetchPastAnalyses]);

  // Initial load
  useEffect(() => {
    fetchEngineStatus();
    fetchAssets();
  }, [fetchEngineStatus, fetchAssets]);

  // Quick Seed Demo CCTV Asset
  const handleSeedDemo = async () => {
    setError("");
    setNotice("");
    try {
      const res = await api<{ seeded: boolean; cctvAssetId?: string; message?: string }>("/evidence/seed-demo");
      setNotice(res.message || "Demo CCTV footage seeded successfully.");
      await fetchAssets();
      if (res.cctvAssetId) {
        const all = await api<EvidenceAsset[]>("/evidence/assets");
        const found = all.find((a) => a.id === res.cctvAssetId);
        if (found) setSelectedAsset(found);
      }
    } catch (e: any) {
      setError(e.message || "Failed to seed demo CCTV footage");
    }
  };

  // Upload Direct Video File
  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setError("Please select a video file (.mp4, .mov, .avi)");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("caseId", uploadCaseId || "NXS-007");
      formData.append("mediaType", "VIDEO");
      formData.append("description", uploadDescription || `CCTV Video Evidence (${uploadFile.name})`);
      formData.append("autoAnalyze", "false");

      const created = await apiForm<EvidenceAsset>("/evidence/upload", formData);
      setNotice(`Video asset ${created.id} uploaded securely (SHA-256: ${created.fileHash.slice(0, 10)}...).`);
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchAssets();
      setSelectedAsset(created);
    } catch (e: any) {
      setError(e.message || "Failed to upload video");
    } finally {
      setUploading(false);
    }
  };

  // Execute CCTV Hunt
  const handleSearch = async () => {
    if (!selectedAsset) {
      setError("Please select a video asset before executing search");
      return;
    }
    if (!query.trim()) {
      setError("Please specify an object query (e.g. 'white SUV' or 'person with red backpack')");
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");
    setSearchStage("Initiating safe frame extraction & neural grounding...");
    setActiveTrack(null);

    const timer = setTimeout(() => {
      setSearchStage("Executing Grounding DINO detection & SAM 2 temporal tracking...");
    }, 1500);

    try {
      const resp = await api<CctvSearchResponse>("/cctv/search", {
        assetId: selectedAsset.id,
        query: query.trim(),
        boxThreshold,
        textThreshold,
      });
      setSearchResult(resp);
      if (resp.tracks.length > 0) {
        setActiveTrack(resp.tracks[0]);
        // Jump to first seen
        seekToTime(resp.tracks[0].firstSeenMs);
        setNotice(`Identified ${resp.tracks.length} object track(s) matching "${resp.query}".`);
      } else {
        setNotice(`No qualifying tracks found matching "${resp.query}" with current confidence thresholds.`);
      }
      fetchPastAnalyses(selectedAsset.id);
    } catch (e: any) {
      setError(e.message || "CCTV hunt execution failed");
    } finally {
      clearTimeout(timer);
      setSearching(false);
      setSearchStage("");
    }
  };

  // Load Past Analysis
  const handleLoadPastAnalysis = async (analysisId: string) => {
    if (!analysisId) return;
    setSelectedPastAnalysisId(analysisId);
    setError("");
    setNotice("");
    try {
      const analysis = await api<CctvAnalysis>(`/cctv/analyses/${analysisId}`);
      const tracks = await api<CctvTrack[]>(`/cctv/analyses/${analysisId}/tracks`);
      setSearchResult({
        analysisId: analysis.id,
        assetId: analysis.evidenceAssetId,
        caseId: analysis.caseId,
        query: analysis.query,
        status: analysis.status,
        trackCount: tracks.length,
        tracks,
        modelMetadata: analysis.modelMetadata || {},
        leadNotice: "SAFEGUARD NOTICE: Machine-generated investigative lead from persistent database records.",
      });
      setQuery(analysis.query);
      if (tracks.length > 0) {
        setActiveTrack(tracks[0]);
        seekToTime(tracks[0].firstSeenMs);
      }
      setNotice(`Loaded archived analysis for query "${analysis.query}" (${tracks.length} tracks).`);
    } catch (e: any) {
      setError(e.message || "Failed to load archived analysis");
    }
  };

  // Seek Video Player
  const seekToTime = (timeMs: number) => {
    if (videoRef.current) {
      const targetSec = Math.max(0, timeMs / 1000);
      videoRef.current.currentTime = targetSec;
      setCurrentTimeMs(timeMs);
    }
  };

  // Play / Pause Video
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoPlaying) {
      videoRef.current.pause();
      setVideoPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setVideoPlaying(true);
    }
  };

  // Playback Rate
  const changeSpeed = (rate: number) => {
    setPlaybackSpeed(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Handle Video Time Update
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curSec = videoRef.current.currentTime;
    setCurrentTimeMs(Math.round(curSec * 1000));
  };

  // Active Overlays computed from current time
  const currentOverlays = useMemo(() => {
    if (!searchResult || searchResult.tracks.length === 0) return [];
    const windowToleranceMs = 450; // tolerance window around current playback timestamp

    const overlays: Array<{
      trackId: string;
      label: string;
      confidence: number;
      bbox: [number, number, number, number];
      association?: any;
      isActiveSelected: boolean;
    }> = [];

    for (const trk of searchResult.tracks) {
      // Check if current time falls within track lifespan
      if (currentTimeMs >= trk.firstSeenMs - windowToleranceMs && currentTimeMs <= trk.lastSeenMs + windowToleranceMs) {
        // Look for matching detection in metadata detections
        const dets = trk.metadata?.detections || [];
        let matchedDet = dets.find(
          (d) => Math.abs(d.timestampMs - currentTimeMs) <= windowToleranceMs
        );
        // Fallback to representative bbox
        const bbox = matchedDet ? matchedDet.bbox : trk.representativeFrame.bbox;
        const conf = matchedDet ? matchedDet.confidence : trk.bestConfidence;
        const assoc = matchedDet?.association || trk.metadata?.compoundAssociation;

        overlays.push({
          trackId: trk.trackId,
          label: trk.label,
          confidence: conf,
          bbox,
          association: assoc,
          isActiveSelected: activeTrack?.trackId === trk.trackId,
        });
      }
    }

    return overlays;
  }, [searchResult, currentTimeMs, activeTrack]);

  // Open Cross-Case Similar Visual Search
  const handleSearchSimilar = async (track: CctvTrack) => {
    setSimilarModal({
      open: true,
      loading: true,
      track,
      result: null,
      error: "",
    });

    try {
      const resp = await api<VisualSearchResponse>(
        `/cctv/tracks/${track.id}/search-similar?threshold=0.50&topK=10`,
        {}
      );
      setSimilarModal((prev) => ({
        ...prev,
        loading: false,
        result: resp,
      }));
    } catch (e: any) {
      setSimilarModal((prev) => ({
        ...prev,
        loading: false,
        error: e.message || "Failed to search similar evidence assets across cases",
      }));
    }
  };

  // Open Review Lead Modal
  const handleOpenReview = (track: CctvTrack) => {
    setReviewModal({
      open: true,
      track,
      decision: "ACCEPTED",
      notes: "",
      submitting: false,
      result: null,
      error: "",
    });
  };

  // Submit Review Lead Decision
  const handleSubmitReview = async () => {
    if (!reviewModal.track) return;
    setReviewModal((prev) => ({ ...prev, submitting: true, error: "" }));

    try {
      const res = await api<EvidenceReviewDecision>(
        `/cctv/tracks/${reviewModal.track.id}/review`,
        {
          decision: reviewModal.decision,
          notes: reviewModal.notes || `Investigator verified CCTV track ${reviewModal.track.trackId} for query ${reviewModal.track.label}`,
        }
      );
      setReviewModal((prev) => ({
        ...prev,
        submitting: false,
        result: res,
      }));
      setNotice(`Investigator determination recorded in cryptographic audit chain: ${res.decision}`);
    } catch (e: any) {
      setReviewModal((prev) => ({
        ...prev,
        submitting: false,
        error: e.message || "Failed to record determination",
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & SYSTEM CAPABILITY SUMMARY                                */}
      {/* ========================================================================= */}
      <div className="bg-[#141b24] border border-[#233549] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-950/70 text-purple-400 border border-purple-800 rounded-lg">
                <Video size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-wide">
                  Natural-Language CCTV Hunt
                </h1>
                <p className="text-xs text-slate-400">
                  Open-Vocabulary Detection (Grounding DINO) · Temporal Tracking (SAM 2.1) · Cross-Case Lead Fusion
                </p>
              </div>
            </div>
          </div>

          {/* Engine Status Pill & Actions */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-2 bg-[#0e131a] border border-[#223347] px-3 py-1.5 rounded-lg text-slate-300">
              <Cpu size={14} className="text-teal-400" />
              <span>Engine:</span>
              {statusLoading ? (
                <RefreshCw size={12} className="animate-spin text-slate-400" />
              ) : (
                <span className="font-mono text-teal-300 font-semibold uppercase">
                  {engineStatus?.device || "CPU"} · {engineStatus?.pipeline_mode || "DINO+SAM2"}
                </span>
              )}
            </div>

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="button compact secondary text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#233549] hover:bg-[#1a2332]"
                  title="Upload a new surveillance video or CCTV clip"
                >
                  <Upload size={14} className="text-purple-400" />
                  <span>Upload Video</span>
                </button>
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  className="button compact secondary text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#233549] hover:bg-[#1a2332]"
                  title="Seed synthetic junction CCTV fixture (moving white SUV + person with red backpack)"
                >
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Seed Demo CCTV</span>
                </button>
                {onNavigateToMultimodal && (
                  <button
                    type="button"
                    onClick={onNavigateToMultimodal}
                    className="button compact secondary text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#233549] hover:bg-[#1a2332]"
                    title="Open Multimodal Evidence Repository"
                  >
                    <Layers size={14} className="text-teal-400" />
                    <span>Evidence Repo</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* MANDATORY INVESTIGATIVE LEAD SAFEGUARD BANNER */}
        <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-amber-300">
              Judicial Safeguard Notice:
            </span>{" "}
            All detected object tracks and bounding coordinates are{" "}
            <strong>MACHINE-GENERATED INVESTIGATIVE LEADS</strong>. Detections do not establish guilt, intent, or conclusive identification. Corroboration by a human investigator and formal determination are required prior to inclusion in court dossiers.
          </div>
        </div>
      </div>

      {/* Notifications / Errors */}
      {error && (
        <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-lg text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-rose-400 hover:text-white">
            <XCircle size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-800 rounded-lg text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice("")} className="text-emerald-400 hover:text-white">
            <CheckCircle2 size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QUERY CONTROL & HYPERPARAMETER TUNING                                  */}
      {/* ========================================================================= */}
      <div className="bg-[#141b24] border border-[#233549] rounded-xl p-5 space-y-4">
        {/* Row 1: Target Video Selector + Past Analyses Dropdown */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs font-semibold text-slate-300 whitespace-nowrap flex items-center gap-1.5">
              <Film size={14} className="text-purple-400" />
              Target CCTV Asset:
            </label>
            <select
              value={selectedAsset?.id || ""}
              onChange={(e) => {
                const found = assets.find((a) => a.id === e.target.value);
                if (found) {
                  setSelectedAsset(found);
                  setSearchResult(null);
                  setActiveTrack(null);
                }
              }}
              className="bg-[#0e131a] border border-[#223347] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 w-full sm:max-w-md"
            >
              {assets.length === 0 ? (
                <option value="">No video evidence enrolled (Click "Seed Demo CCTV" or "Upload")</option>
              ) : (
                assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} — {a.fileName} ({a.caseId}) · {(a.fileSize / 1024).toFixed(0)} KB
                  </option>
                ))
              )}
            </select>
          </div>

          {pastAnalyses.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Past Searches:</span>
              <select
                value={selectedPastAnalysisId}
                onChange={(e) => handleLoadPastAnalysis(e.target.value)}
                className="bg-[#0e131a] border border-[#223347] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
              >
                <option value="">Select past query...</option>
                {pastAnalyses.map((an) => (
                  <option key={an.id} value={an.id}>
                    "{an.query}" · {an.status} · {new Date(an.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row 2: Search Input & Execute Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !searching) handleSearch();
              }}
              placeholder="Enter natural-language query e.g. 'white SUV', 'person with red backpack', 'red motorcycle'..."
              className="w-full bg-[#0e131a] border border-[#233549] rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((p) => !p)}
              className={`button compact secondary text-xs py-2.5 px-3 rounded-lg border flex items-center gap-1.5 transition-colors ${
                showAdvanced ? "bg-[#1f2d3d] border-purple-500 text-purple-300" : "border-[#233549] text-slate-300"
              }`}
              title="Tune detection & tracking hyperparameters"
            >
              <Sliders size={14} />
              <span>Tune Parameters</span>
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !selectedAsset || !canEdit}
              className="button compact primary text-xs font-semibold py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md disabled:opacity-50"
            >
              {searching ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Hunting...</span>
                </>
              ) : (
                <>
                  <Crosshair size={14} />
                  <span>Hunt In CCTV</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Quick Targets:
          </span>
          {SUGGESTED_QUERIES.map((sug) => (
            <button
              key={sug.label}
              type="button"
              onClick={() => setQuery(sug.label)}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                query.toLowerCase() === sug.label.toLowerCase()
                  ? "bg-purple-950/80 border-purple-500 text-purple-200 font-bold"
                  : "bg-[#0e131a] border-[#223347] text-slate-300 hover:border-slate-500"
              }`}
              title={sug.desc}
            >
              {sug.type === "Compound" ? "🔗 " : "🎯 "}
              {sug.label}
            </button>
          ))}
        </div>

        {/* Collapsible Hyperparameter Tuning Panel */}
        {showAdvanced && (
          <div className="p-4 bg-[#0a0f16] border border-[#223347] rounded-lg mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Box Threshold</span>
                <span className="font-mono text-purple-400">{boxThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={boxThreshold}
                onChange={(e) => setBoxThreshold(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Min bounding box confidence</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Text Threshold</span>
                <span className="font-mono text-purple-400">{textThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={textThreshold}
                onChange={(e) => setTextThreshold(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Open-vocabulary query alignment</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Re-Grounding Interval</span>
                <span className="font-mono text-purple-400">{regroundInterval} frames</span>
              </div>
              <input
                type="range"
                min="15"
                max="90"
                step="15"
                value={regroundInterval}
                onChange={(e) => setRegroundInterval(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Frequency of Grounding DINO runs</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Sampling FPS</span>
                <span className="font-mono text-purple-400">{sampleFps.toFixed(1)} FPS</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.5"
                value={sampleFps}
                onChange={(e) => setSampleFps(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Decoded frame rate rate</span>
            </div>
          </div>
        )}

        {/* Searching Progress Indicator */}
        {searching && (
          <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-lg flex items-center gap-3 text-xs text-purple-200">
            <RefreshCw size={16} className="animate-spin text-purple-400 shrink-0" />
            <div className="space-y-0.5">
              <span className="font-bold uppercase tracking-wider text-purple-300">
                Processing Footage:
              </span>{" "}
              {searchStage || "Analyzing video frames with pretrained neural models..."}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. DUAL-VIEW WORKBENCH: INTERACTIVE VIDEO PLAYER & TRACK TIMELINE        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive HTML5 Video Player with Synchronized Overlays */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#141b24] border border-[#233549] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Video size={14} className="text-purple-400" />
                  Footage Monitor
                </span>
                {selectedAsset && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    [{selectedAsset.caseId}] {selectedAsset.fileName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-semibold">
                <span>{(currentTimeMs / 1000).toFixed(1)}s</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-400">{videoDurationSec.toFixed(1)}s</span>
              </div>
            </div>

            {/* Video Player Display Container with SVG Overlay */}
            <div className="relative bg-black rounded-lg overflow-hidden border border-[#1e2a3a] aspect-video flex items-center justify-center select-none group">
              {videoBlobUrl ? (
                <>
                  {!videoLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 text-slate-400 text-xs">
                      <RefreshCw size={18} className="animate-spin text-purple-400 mr-2" />
                      <span>Loading video stream...</span>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    src={videoBlobUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        setVideoDurationSec(videoRef.current.duration || 0);
                        setVideoLoaded(true);
                      }
                    }}
                    onEnded={() => setVideoPlaying(false)}
                    className="w-full h-full object-contain pointer-events-auto"
                    playsInline
                  />

                  {/* SVG Synchronized Bounding Box Overlays */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                  >
                    {currentOverlays.map((ov, idx) => {
                      const [x1, y1, x2, y2] = ov.bbox;
                      const sx = x1 * 1000;
                      const sy = y1 * 1000;
                      const sw = (x2 - x1) * 1000;
                      const sh = (y2 - y1) * 1000;
                      const strokeColor = ov.isActiveSelected ? "#a855f7" : "#06b6d4";

                      return (
                        <g key={`${ov.trackId}-${idx}`}>
                          {/* Pulsing Bounding Box */}
                          <rect
                            x={sx}
                            y={sy}
                            width={sw}
                            height={sh}
                            fill="rgba(168, 85, 247, 0.15)"
                            stroke={strokeColor}
                            strokeWidth={ov.isActiveSelected ? "4" : "2.5"}
                            strokeDasharray={ov.isActiveSelected ? "none" : "6,3"}
                          />

                          {/* Tactical Corner Reticles */}
                          <line x1={sx} y1={sy} x2={sx + 20} y2={sy} stroke={strokeColor} strokeWidth="4" />
                          <line x1={sx} y1={sy} x2={sx} y2={sy + 20} stroke={strokeColor} strokeWidth="4" />
                          <line x1={sx + sw} y1={sy} x2={sx + sw - 20} y2={sy} stroke={strokeColor} strokeWidth="4" />
                          <line x1={sx + sw} y1={sy} x2={sx + sw} y2={sy + 20} stroke={strokeColor} strokeWidth="4" />
                          <line x1={sx} y1={sy + sh} x2={sx + 20} y2={sy + sh} stroke={strokeColor} strokeWidth="4" />
                          <line x1={sx} y1={sy + sh} x2={sx} y2={sy + sh - 20} stroke={strokeColor} strokeWidth="4" />
                          <line x1={sx + sw} y1={sy + sh} x2={sx + sw - 20} y2={sy + sh} stroke={strokeColor} strokeWidth="4" />
                          <line x1={sx + sw} y1={sy + sh} x2={sx + sw} y2={sy + sh - 20} stroke={strokeColor} strokeWidth="4" />

                          {/* Target Label Banner */}
                          <rect
                            x={sx}
                            y={Math.max(0, sy - 35)}
                            width={Math.max(140, ov.label.length * 12 + 80)}
                            height="32"
                            fill="#141b24"
                            stroke={strokeColor}
                            strokeWidth="1.5"
                            rx="4"
                          />
                          <text
                            x={sx + 10}
                            y={Math.max(22, sy - 14)}
                            fill="#ffffff"
                            fontSize="18"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            [{ov.trackId}] {ov.label} ({(ov.confidence * 100).toFixed(0)}%)
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </>
              ) : (
                <div className="text-center p-8 text-slate-500 text-xs space-y-2">
                  <Film size={32} className="mx-auto text-slate-600 mb-2" />
                  <p>No video loaded.</p>
                  <p className="text-[11px] text-slate-600">
                    Select a CCTV asset above, upload an MP4, or seed the demo fixture.
                  </p>
                </div>
              )}
            </div>

            {/* Playback Controls & Scrubber */}
            {videoBlobUrl && (
              <div className="space-y-2.5 pt-1">
                {/* Timeline Scrubber Bar with Track Detection Markers */}
                <div
                  className="relative h-4 bg-[#0a0f16] rounded-md border border-[#1e2a3a] cursor-pointer group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    if (videoDurationSec > 0) {
                      seekToTime(ratio * videoDurationSec * 1000);
                    }
                  }}
                  title="Click to seek playback"
                >
                  {/* Progress Fill */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-purple-600/60 rounded-l"
                    style={{
                      width: `${videoDurationSec > 0 ? (currentTimeMs / 1000 / videoDurationSec) * 100 : 0}%`,
                    }}
                  />

                  {/* Highlight track active segments on progress bar */}
                  {searchResult?.tracks.map((trk) => {
                    if (videoDurationSec <= 0) return null;
                    const leftPct = (trk.firstSeenMs / 1000 / videoDurationSec) * 100;
                    const widthPct = Math.max(1.5, ((trk.lastSeenMs - trk.firstSeenMs) / 1000 / videoDurationSec) * 100);
                    return (
                      <div
                        key={trk.trackId}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        className={`absolute top-0 bottom-0 pointer-events-none ${
                          activeTrack?.trackId === trk.trackId ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "bg-teal-400/80"
                        }`}
                        title={`${trk.trackId}: ${trk.label}`}
                      />
                    );
                  })}

                  {/* Scrubber Cursor */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow pointer-events-none"
                    style={{
                      left: `${videoDurationSec > 0 ? (currentTimeMs / 1000 / videoDurationSec) * 100 : 0}%`,
                    }}
                  />
                </div>

                {/* Buttons Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="button compact secondary py-1.5 px-3 rounded flex items-center gap-1.5 text-xs text-white"
                    >
                      {videoPlaying ? <Pause size={14} /> : <Play size={14} />}
                      <span>{videoPlaying ? "Pause" : "Play"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => seekToTime(0)}
                      className="button compact secondary py-1.5 px-2.5 rounded text-slate-300 hover:text-white"
                      title="Rewind to start"
                    >
                      <RotateCcw size={13} />
                    </button>

                    {activeTrack && (
                      <button
                        type="button"
                        onClick={() => seekToTime(activeTrack.firstSeenMs)}
                        className="button compact secondary py-1.5 px-2.5 rounded text-purple-300 border-purple-800/60 bg-purple-950/40 text-xs flex items-center gap-1"
                        title="Jump to track first seen timestamp"
                      >
                        <Clock size={12} />
                        <span>Jump to {activeTrack.trackId}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px]">Speed:</span>
                    {[0.5, 1.0, 2.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => changeSpeed(spd)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                          playbackSpeed === spd
                            ? "bg-purple-900 text-purple-200 font-bold"
                            : "bg-[#0e131a] text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detected Tracks, Thumbnails & Forensic Lead Actions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#141b24] border border-[#233549] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Crosshair size={14} className="text-purple-400" />
                Tracked Targets & Forensic Leads
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono">
                {searchResult ? `${searchResult.trackCount} Tracks` : "0 Tracks"}
              </span>
            </div>

            {searchResult && searchResult.tracks.length > 0 ? (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {searchResult.tracks.map((trk) => {
                  const isSelected = activeTrack?.trackId === trk.trackId;
                  const isCompound = !!trk.metadata?.compoundAssociation;

                  return (
                    <div
                      key={trk.id || trk.trackId}
                      className={`p-3.5 bg-[#0e131a] border rounded-lg space-y-2.5 transition-all duration-150 ${
                        isSelected
                          ? "border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.25)] bg-[#131b26]"
                          : "border-[#223347] hover:border-slate-600"
                      }`}
                    >
                      {/* Track Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-950 text-purple-300 border border-purple-800">
                              {trk.trackId}
                            </span>
                            <span className="text-xs font-bold text-white capitalize">
                              {trk.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                            <Clock size={11} className="text-purple-400" />
                            <span>
                              {trk.metadata?.firstSeenDisplay || "00:00.0"} – {trk.metadata?.lastSeenDisplay || "00:00.0"}
                            </span>
                            <span className="text-slate-500">·</span>
                            <span>{trk.metadata?.detectionCount || 1} detections</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-teal-400">
                            {(trk.bestConfidence * 100).toFixed(0)}%
                          </span>
                          <div className="text-[10px] text-slate-500 uppercase">Confidence</div>
                        </div>
                      </div>

                      {/* Compound association note if present */}
                      {isCompound && trk.metadata?.compoundAssociation && (
                        <div className="text-[11px] bg-indigo-950/40 border border-indigo-800/60 p-2 rounded text-indigo-200">
                          <span className="font-bold text-indigo-300">Compound Association:</span>{" "}
                          {trk.metadata.compoundAssociation.description} (persisted across {trk.metadata.compoundAssociation.persistenceFrames} frames)
                        </div>
                      )}

                      {/* Dual Thumbnails: Full Frame Scene + Cropped Object */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Full Scene
                          </span>
                          <div className="aspect-video bg-black rounded border border-[#1e2a3a] overflow-hidden">
                            <img
                              src={trk.representativeFrame.thumbnail}
                              alt="Full Scene"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Object Crop
                          </span>
                          <div className="aspect-video bg-black rounded border border-[#1e2a3a] overflow-hidden flex items-center justify-center p-1">
                            <img
                              src={trk.representativeFrame.cropThumbnail}
                              alt="Target Crop"
                              className="max-h-full max-w-full object-contain rounded"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Forensic Lead Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#1e2a3a]">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTrack(trk);
                            seekToTime(trk.firstSeenMs);
                          }}
                          className="button compact secondary text-xs py-1 px-2.5 rounded flex items-center gap-1.5 text-slate-200 hover:text-white"
                          title="Seek video player to this track"
                        >
                          <Play size={12} className="text-purple-400" />
                          <span>View Footage</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSearchSimilar(trk)}
                          className="button compact secondary text-xs py-1 px-2.5 rounded flex items-center gap-1.5 text-teal-300 border-teal-800/60 bg-teal-950/40 hover:bg-teal-900/60"
                          title="Search for similar vehicles or objects across all enrolled case files"
                        >
                          <Eye size={12} className="text-teal-400" />
                          <span>Cross-Case Match</span>
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(trk)}
                            className="button compact secondary text-xs py-1 px-2.5 rounded flex items-center gap-1.5 text-amber-300 border-amber-800/60 bg-amber-950/40 hover:bg-amber-900/60"
                            title="Record formal investigator determination for judicial dossier"
                          >
                            <FileCheck size={12} className="text-amber-400" />
                            <span>Review Lead</span>
                          </button>
                        )}

                        {onNavigateToEntity && (
                          <button
                            type="button"
                            onClick={() => {
                              const match = _graph?.nodes?.find(
                                (n) => n.label.toLowerCase().includes(trk.label.toLowerCase()) || trk.label.toLowerCase().includes(n.label.toLowerCase())
                              );
                              if (match) onNavigateToEntity(match.id);
                            }}
                            className="button compact secondary text-xs py-1 px-2 rounded flex items-center gap-1 text-slate-400 hover:text-white"
                            title="Inspect corresponding entity in relational graph"
                          >
                            <span>Graph</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs bg-[#0e131a] rounded-lg space-y-2">
                <Search size={28} className="mx-auto text-slate-600 mb-1" />
                <p>No CCTV hunt executed yet.</p>
                <p className="text-[11px] text-slate-600">
                  Select a target CCTV clip, type a query like "white SUV" or "person with red backpack", and click "Hunt In CCTV".
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: CROSS-CASE VISUAL EVIDENCE SIMILARITY SEARCH (OpenCLIP)         */}
      {/* ========================================================================= */}
      {similarModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141b24] border border-[#233549] rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#233549] pb-3">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-teal-400" />
                <h3 className="text-sm font-bold text-white">
                  Cross-Case Visual Lead Match (OpenCLIP ViT-B-32)
                </h3>
              </div>
              <button
                onClick={() => setSimilarModal((prev) => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-white"
              >
                <XCircle size={18} />
              </button>
            </div>

            {/* Probe Crop Details */}
            {similarModal.track && (
              <div className="p-3 bg-[#0e131a] border border-[#223347] rounded-lg flex items-center gap-4">
                <div className="w-16 h-16 bg-black rounded border border-[#1e2a3a] overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={similarModal.track.representativeFrame.cropThumbnail}
                    alt="Probe Crop"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-white font-bold">
                    CCTV Probe: {similarModal.track.trackId} ({similarModal.track.label})
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    Timestamp: {similarModal.track.metadata?.firstSeenDisplay || "00:00.0"} · Source: {selectedAsset?.fileName} ({selectedAsset?.caseId})
                  </div>
                </div>
              </div>
            )}

            {/* Mandatory Judicial Safeguard in Modal */}
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>INVESTIGATIVE LEAD NOTICE:</strong> Visual similarity rankings compare 512-dimensional normalized OpenCLIP embeddings. High cosine similarity suggests visual correspondence across cases but does <em>not</em> prove identical ownership or legal nexus.
              </div>
            </div>

            {/* Modal Body: Loading or Results */}
            {similarModal.loading ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <RefreshCw size={24} className="mx-auto animate-spin text-teal-400" />
                <p>Generating OpenCLIP ViT-B-32 embedding and searching cross-case vector store...</p>
              </div>
            ) : similarModal.error ? (
              <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-lg text-rose-200 text-xs">
                {similarModal.error}
              </div>
            ) : similarModal.result && similarModal.result.matches.length > 0 ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  Found {similarModal.result.totalMatches} cross-case visual lead(s) meeting similarity threshold &ge; {Math.round(similarModal.result.threshold * 100)}%:
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {similarModal.result.matches.map((lead, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#0e131a] border border-[#223347] rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-black rounded border border-[#1e2a3a] overflow-hidden shrink-0 flex items-center justify-center">
                          {lead.thumbnail ? (
                            <img src={lead.thumbnail} alt="Match" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Film size={18} className="text-slate-600" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800">
                              {lead.matchCaseId}
                            </span>
                            <span className="text-white font-bold">{lead.matchAssetId}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 max-w-md truncate">
                            {lead.leadDisclaimer || "Evidence file matched via unit cosine distance"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold font-mono text-teal-400">
                          {lead.similarityScore}%
                        </span>
                        <div className="text-[10px] text-slate-500 uppercase">Similarity</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs bg-[#0e131a] rounded-lg">
                No cross-case visual matches found above threshold.
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#233549]">
              <button
                type="button"
                onClick={() => setSimilarModal((prev) => ({ ...prev, open: false }))}
                className="button compact secondary text-xs py-1.5 px-4 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: INVESTIGATOR REVIEW & CANONICAL AUDIT CHAIN RECORDING           */}
      {/* ========================================================================= */}
      {reviewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141b24] border border-[#233549] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#233549] pb-3">
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Record Investigator Determination
                </h3>
              </div>
              <button
                onClick={() => setReviewModal((prev) => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-white"
              >
                <XCircle size={18} />
              </button>
            </div>

            {reviewModal.track && (
              <div className="p-3 bg-[#0e131a] border border-[#223347] rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Track:</span>
                  <span className="font-mono text-purple-300 font-bold">{reviewModal.track.trackId} ({reviewModal.track.label})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Temporal Window:</span>
                  <span className="font-mono text-slate-300">{reviewModal.track.metadata?.firstSeenDisplay} – {reviewModal.track.metadata?.lastSeenDisplay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Confidence:</span>
                  <span className="font-mono text-teal-400 font-bold">{(reviewModal.track.bestConfidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            {/* Decision selector */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-300 font-semibold block">
                Determination Decision:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["ACCEPTED", "CORROBORATED", "REJECTED"] as const).map((dec) => (
                  <button
                    key={dec}
                    type="button"
                    onClick={() => setReviewModal((prev) => ({ ...prev, decision: dec }))}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      reviewModal.decision === dec
                        ? dec === "ACCEPTED"
                          ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                          : dec === "CORROBORATED"
                          ? "bg-purple-950 border-purple-500 text-purple-300"
                          : "bg-rose-950 border-rose-500 text-rose-300"
                        : "bg-[#0e131a] border-[#223347] text-slate-400 hover:text-white"
                    }`}
                  >
                    {dec}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes Textarea */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-300 font-semibold block">
                Investigator Rationale & Case Notes:
              </label>
              <textarea
                value={reviewModal.notes}
                onChange={(e) => setReviewModal((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="State corroborating factors, location correlation, or reasons for rejection..."
                rows={3}
                className="w-full bg-[#0e131a] border border-[#223347] rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>

            {reviewModal.error && (
              <div className="p-2.5 bg-rose-950/70 border border-rose-800 rounded text-rose-200 text-xs">
                {reviewModal.error}
              </div>
            )}

            {reviewModal.result && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded text-emerald-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  Determination Logged in Audit Chain
                </div>
                <div className="text-[11px] font-mono text-emerald-300">
                  Review ID: {reviewModal.result.id} · Decision: {reviewModal.result.decision}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#233549]">
              <button
                type="button"
                onClick={() => setReviewModal((prev) => ({ ...prev, open: false }))}
                className="button compact secondary text-xs py-1.5 px-4 rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={reviewModal.submitting}
                className="button compact primary text-xs font-semibold py-1.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
              >
                {reviewModal.submitting ? "Signing..." : "Record Determination"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: UPLOAD NEW CCTV VIDEO FOOTAGE                                  */}
      {/* ========================================================================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleUploadVideo}
            className="bg-[#141b24] border border-[#233549] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#233549] pb-3">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  Ingest CCTV / Surveillance Video
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Video File (.mp4, .mov, .avi)
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-msvideo"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setUploadFile(f);
                  }}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-700 file:text-white hover:file:bg-purple-600 bg-[#0e131a] border border-[#223347] rounded-lg p-2 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Case Identifier
                </label>
                <input
                  type="text"
                  value={uploadCaseId}
                  onChange={(e) => setUploadCaseId(e.target.value)}
                  placeholder="e.g. NXS-007, CASE-019..."
                  className="w-full bg-[#0e131a] border border-[#223347] rounded-lg p-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Description / Camera Location
                </label>
                <input
                  type="text"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="e.g. Navapur Junction Camera 04 North Corridor"
                  className="w-full bg-[#0e131a] border border-[#223347] rounded-lg p-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#233549]">
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="button compact secondary text-xs py-1.5 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="button compact primary text-xs font-semibold py-1.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {uploading ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Ingesting...</span>
                  </>
                ) : (
                  <>
                    <Upload size={12} />
                    <span>Upload & Ingest</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
