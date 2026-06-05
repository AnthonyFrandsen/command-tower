import { useCallback, useState } from "react";
import { createRun, streamRun } from "../api.js";
import OutputViewer from "../components/OutputViewer.js";
import PromptForm from "../components/PromptForm.js";
import type { RunStatus } from "../types.js";
import "./PromptPage.css";

export default function PromptPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<RunStatus>("pending");
  const [hasRun, setHasRun] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (prompt: string) => {
    setIsRunning(true);
    setLines([]);
    setStatus("running");
    setHasRun(true);
    setError(null);

    try {
      const { runId } = await createRun(prompt);

      const cleanup = streamRun(
        runId,
        (line) => setLines((prev) => [...prev, line]),
        () => {
          setIsRunning(false);
          cleanup();
          // Final status is reflected on the next line fetch, but we optimistically set done.
          setStatus((prev) => (prev === "running" ? "done" : prev));
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
      setIsRunning(false);
    }
  }, []);

  return (
    <div className="page prompt-page">
      <h1 className="page-title">Prompt</h1>
      {error && <div className="error-message">{error}</div>}
      <PromptForm onSubmit={(p) => void handleSubmit(p)} disabled={isRunning} />
      {hasRun && <OutputViewer lines={lines} status={status} />}
    </div>
  );
}
