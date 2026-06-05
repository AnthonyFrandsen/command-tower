import type { RunStatus } from "../types.js";
import "./StatusBadge.css";

interface Props {
  status: RunStatus;
}

const labels: Record<RunStatus, string> = {
  pending: "Pending",
  running: "Running",
  done: "Done",
  error: "Error",
};

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`status-badge status-${status}`}>
      {status === "running" && <span className="spinner" />}
      {labels[status]}
    </span>
  );
}
