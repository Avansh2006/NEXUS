import { useState, useEffect, useRef } from "react";
import {
  RotateCcw,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Clock,
  Layers,
  PlusCircle,
  FileText,
  Phone,
  CreditCard,
  ShieldAlert,
} from "lucide-react";
import { api } from "./types";
import type { ReplayResponse, ReplayStep } from "./types";

interface Props {
  onSelectEntity?: (label: string) => void;
}

export default function InvestigationReplay({ onSelectEntity }: Props) {
  const [data, setData] = useState<ReplayResponse | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const timerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadReplay();
  }, []);

  const loadReplay = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api<ReplayResponse>("/investigation/replay");
      setData(res);
      if (res.steps.length > 0) {
        setCurrentStep(1);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load investigation replay");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPlaying && data && data.steps.length > 0) {
      timerRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= data.steps.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000 / speed);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, data]);

  const stepObj: ReplayStep | undefined = data?.steps[currentStep - 1];

  const handleStepChange = (newStep: number) => {
    if (!data) return;
    const clamped = Math.max(1, Math.min(newStep, data.steps.length));
    setCurrentStep(clamped);
  };

  const getKindIcon = (kind: string) => {
    switch (kind.toLowerCase()) {
      case "cdr":
        return <Phone size={14} className="text-cyan-600" />;
      case "transactions":
        return <CreditCard size={14} className="text-emerald-600" />;
      case "fir":
        return <FileText size={14} className="text-indigo-600" />;
      default:
        return <Layers size={14} className="text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <RotateCcw className="animate-spin mb-3 text-emerald-600" size={28} />
        <span>Synthesizing chronological evidence replay timeline...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-semibold">Replay Initialization Error</p>
        <p className="text-sm">{error || "No replay steps found"}</p>
        <button
          onClick={loadReplay}
          className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Scrubber */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full uppercase tracking-wider">
                Investigation Evolution
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Step {currentStep} of {data.totalSteps}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">
              Evidence Playback & Graph Evolution
            </h2>
            <p className="text-xs text-slate-500">
              Scrub through forensic records in historical ingestion order. Inspect step-level graph mutations.
            </p>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
            <button
              onClick={() => handleStepChange(1)}
              disabled={currentStep <= 1}
              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 transition"
              title="First Step"
            >
              <SkipBack size={16} />
            </button>
            <button
              onClick={() => handleStepChange(currentStep - 1)}
              disabled={currentStep <= 1}
              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 transition"
              title="Previous Step"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                isPlaying
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "bg-emerald-700 text-white hover:bg-emerald-800"
              }`}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => handleStepChange(currentStep + 1)}
              disabled={currentStep >= data.totalSteps}
              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 transition"
              title="Next Step"
            >
              <FastForward size={16} />
            </button>
            <button
              onClick={() => handleStepChange(data.totalSteps)}
              disabled={currentStep >= data.totalSteps}
              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 transition"
              title="Final Step"
            >
              <SkipForward size={16} />
            </button>
            <div className="h-4 w-px bg-slate-300 mx-1" />
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="text-xs bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-700"
              title="Playback Speed"
            >
              <option value={1}>1x Speed</option>
              <option value={2}>2x Speed</option>
              <option value={5}>5x Speed</option>
            </select>
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min={1}
            max={data.totalSteps}
            value={currentStep}
            onChange={(e) => handleStepChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
          />
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Step 1: Ingestion Start</span>
            <span className="text-emerald-700 font-bold">
              {stepObj ? stepObj.timestamp : ""}
            </span>
            <span>Step {data.totalSteps}: Full Graph</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Step Details vs Timeline Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Step Diff Panel */}
        <div className="lg:col-span-2 space-y-4">
          {stepObj ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-slate-100 rounded-md border border-slate-200">
                      {getKindIcon(stepObj.kind)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {stepObj.kind} Record
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-mono rounded">
                      Case {stepObj.caseId}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {stepObj.summary}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 font-mono">
                  <Clock size={12} />
                  {stepObj.timestamp}
                </div>
              </div>

              {/* Step Delta Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <PlusCircle size={14} className="text-emerald-600" />
                      Entities Discovered At This Step
                    </span>
                    <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded text-[10px]">
                      +{stepObj.delta.nodesAdded.length}
                    </span>
                  </div>
                  {stepObj.delta.nodesAdded.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {stepObj.delta.nodesAdded.map((label) => (
                        <button
                          key={label}
                          onClick={() => onSelectEntity?.(label)}
                          className="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded text-xs hover:bg-emerald-100 transition"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No new entity nodes introduced.
                    </p>
                  )}
                </div>

                <div className="p-4 bg-cyan-50/50 border border-cyan-100 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-cyan-900">
                    <span className="flex items-center gap-1.5">
                      <Layers size={14} className="text-cyan-600" />
                      Relationships Formed
                    </span>
                    <span className="bg-cyan-200 text-cyan-800 px-1.5 py-0.2 rounded text-[10px]">
                      +{stepObj.delta.edgesAdded.length}
                    </span>
                  </div>
                  {stepObj.delta.edgesAdded.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {stepObj.delta.edgesAdded.map((edgeDesc, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-white border border-cyan-300 text-cyan-800 rounded text-xs"
                        >
                          {edgeDesc}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No new graph relationships formed.
                    </p>
                  )}
                </div>
              </div>

              {/* Alert Impacts */}
              {stepObj.delta.alertsTriggered.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
                  <ShieldAlert size={16} className="text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Analytical Alert Triggered:</strong>{" "}
                    {stepObj.delta.alertsTriggered.join(", ")}
                  </span>
                </div>
              )}

              {/* Cumulative Metrics at this step */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Cumulative Network Scope At Step {currentStep}
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-lg font-bold text-slate-800">
                      {stepObj.cumulative.nodeCount}
                    </div>
                    <div className="text-[11px] text-slate-500">Active Nodes</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-lg font-bold text-slate-800">
                      {stepObj.cumulative.edgeCount}
                    </div>
                    <div className="text-[11px] text-slate-500">Active Edges</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-lg font-bold text-amber-600">
                      {stepObj.cumulative.alertCount}
                    </div>
                    <div className="text-[11px] text-slate-500">Alerts Formed</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400">
              Select a step to inspect graph diffs.
            </div>
          )}
        </div>

        {/* Right Column: Step History Feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-[540px] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Step Sequence Feed
            </span>
            <span className="text-[11px] text-slate-400">
              {data.steps.length} Ingested Events
            </span>
          </div>
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs"
          >
            {data.steps.map((s) => {
              const active = s.step === currentStep;
              return (
                <button
                  key={s.step}
                  onClick={() => handleStepChange(s.step)}
                  className={`w-full text-left p-2.5 rounded-lg border transition ${
                    active
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm"
                      : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold text-slate-400">
                      Step #{s.step}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {s.timestamp.slice(0, 10)}
                    </span>
                  </div>
                  <p className="font-medium text-xs mt-1 truncate">
                    {s.summary}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                    <span className="px-1.5 py-0.2 bg-white border border-slate-200 rounded uppercase">
                      {s.kind}
                    </span>
                    <span>+{s.delta.nodesAdded.length} nodes</span>
                    <span>+{s.delta.edgesAdded.length} edges</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
