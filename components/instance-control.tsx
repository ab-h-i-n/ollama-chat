"use client";

import { type InstanceStatus } from "@/app/actions";
import { Loader2, Power, RefreshCw, Lock, X } from "lucide-react";
import { useState, FormEvent } from "react";

interface InstanceControlProps {
  status: InstanceStatus | null;
  loading: boolean;
  polling: boolean;
  onToggle: (password: string) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
}

export function InstanceControl({
  status,
  loading,
  polling,
  onToggle,
  onRefresh,
}: InstanceControlProps) {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!status)
    return (
      <div className="px-3 py-2 text-xs text-[var(--text-muted)]">
        Loading status...
      </div>
    );

  const isRunning = status.state === "running";
  const isTransitioning =
    status.state !== "running" && status.state !== "stopped";

  const handleToggleClick = () => {
    setPassword("");
    setError("");
    setShowPasswordPrompt(true);
  };

  const handleSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setError("");
    const result = await onToggle(password);
    if (result.success) {
      setShowPasswordPrompt(false);
      setPassword("");
    } else {
      setError(result.error || "Invalid password");
    }
  };

  const handleCancel = () => {
    setShowPasswordPrompt(false);
    setPassword("");
    setError("");
  };

  return (
    <div className="px-1 pb-2 space-y-2">
      {/* Status row */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isRunning
                ? "bg-green-500"
                : status.state === "stopped"
                  ? "bg-red-500"
                  : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            {status.state}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Refresh Status"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${polling ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Password prompt */}
      {showPasswordPrompt ? (
        <form onSubmit={handleSubmitPassword} className="space-y-2 px-1">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Lock className="w-3 h-3" />
            <span>Enter password</span>
            <button
              type="button"
              onClick={handleCancel}
              className="ml-auto p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#2a2a2a] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
          />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={!password.trim() || loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Power className="w-3.5 h-3.5" />
            )}
            {isRunning ? "Stop Server" : "Start Server"}
          </button>
        </form>
      ) : (
        <button
          onClick={handleToggleClick}
          disabled={loading || isTransitioning}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            isRunning
              ? "bg-[#2a2a2a] hover:bg-[#333] text-[var(--text-secondary)]"
              : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
          } ${loading || isTransitioning ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading || isTransitioning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Lock className="w-3 h-3 opacity-50" />
              <Power className="w-3.5 h-3.5" />
            </>
          )}
          {isRunning ? "Stop Server" : "Start Server"}
        </button>
      )}
    </div>
  );
}
