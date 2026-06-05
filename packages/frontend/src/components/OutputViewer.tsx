import { useEffect, useRef } from "react";
import type { RunStatus } from "../types.js";
import StatusBadge from "./StatusBadge.js";
import "./OutputViewer.css";

interface Props {
  lines: string[];
  status: RunStatus;
}

export default function OutputViewer({ lines, status }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally triggers scroll when lines arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="output-viewer">
      <div className="output-header">
        <span className="output-label">Output</span>
        <StatusBadge status={status} />
      </div>
      <pre className="output-content">
        {lines.length === 0 ? (
          <span className="output-empty">
            {status === "running" ? "Waiting for output…" : "No output"}
          </span>
        ) : (
          lines.join("")
        )}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}
