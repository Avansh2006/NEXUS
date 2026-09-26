import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("NEXUS ErrorBoundary caught unhandled component error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#071317] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 flex items-center justify-center mb-4 shadow-lg shadow-red-950/40">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-base font-bold mb-2 tracking-wide text-slate-100">
            Workbench View Recovered
          </h2>
          <p className="text-xs text-[#8aa1a7] max-w-md mb-6 leading-relaxed">
            A temporary component error was intercepted. The investigation database and audit chain remain completely intact.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-[#143d34] hover:bg-[#1a4f43] text-[#6ee7b7] text-xs font-semibold border border-[#2a6859] transition-all flex items-center gap-2 shadow"
            >
              <RotateCcw size={14} /> Refresh Workspace
            </button>
            <button
              onClick={() => {
                sessionStorage.clear();
                window.location.href = window.location.pathname;
              }}
              className="px-4 py-2 rounded-lg bg-[#182a2e] hover:bg-[#20363b] text-slate-300 text-xs font-semibold border border-[#2c474d] transition-all shadow"
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
