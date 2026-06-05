import type { RunSummary } from "../types.js";
import StatusBadge from "./StatusBadge.js";
import "./RunCard.css";

interface Props {
  run: RunSummary;
  isSelected?: boolean;
  onClick: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function RunCard({ run, isSelected = false, onClick }: Props) {
  const excerpt = run.prompt.length > 80 ? `${run.prompt.slice(0, 80)}…` : run.prompt;

  return (
    <button
      type="button"
      className={`run-card ${isSelected ? "is-selected" : ""}`}
      onClick={onClick}
    >
      <div className="run-card-top">
        <StatusBadge status={run.status} />
        <span className="run-card-time">{formatDate(run.startedAt)}</span>
      </div>
      <p className="run-card-prompt">{excerpt}</p>
      {run.durationMs !== null && (
        <span className="run-card-duration">{formatDuration(run.durationMs)}</span>
      )}
    </button>
  );
}
