import { useEffect, useState } from "react";
import { getGitDiff, getGitStatus } from "../api.js";
import DiffViewer from "../components/DiffViewer.js";
import type { GitStatus } from "../types.js";
import "./GitPage.css";

export default function GitPage() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(true);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    const fetchStatus = () => {
      getGitStatus()
        .then((s) => {
          setStatus(s);
          setError(null);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDiffLoading(true);
    setDiffError(null);
    getGitDiff(selectedPath ?? undefined)
      .then((d) => {
        setDiff(d);
        setDiffError(null);
      })
      .catch((e: Error) => {
        setDiff("");
        setDiffError(e.message);
      })
      .finally(() => setDiffLoading(false));
  }, [selectedPath]);

  const handleSelectFile = (path: string | null) => {
    setSelectedPath(path);
    setShowDiff(true);
  };

  const handleBack = () => {
    setShowDiff(false);
  };

  const renderDiffContent = () => {
    if (diffError) {
      if (diffError === "No commits yet") {
        return <div className="empty-state">No commits yet</div>;
      }
      return <div className="error-msg">{diffError}</div>;
    }
    if (diffLoading) {
      return <DiffViewer diff="" loading />;
    }
    if (diff === "" && !diffLoading) {
      const msg = selectedPath ? "No changes in this file" : "No uncommitted changes";
      return <div className="empty-state">{msg}</div>;
    }
    return <DiffViewer diff={diff} />;
  };

  const renderStatusContent = () => {
    if (loading) {
      return (
        <div className="loading-row">
          <span className="spinner" /> Loading…
        </div>
      );
    }
    if (error) {
      return <div className="error-msg">{error}</div>;
    }
    if (!status) return null;
    if (!status.isGitRepo) {
      return <div className="empty-state">Not a git repository</div>;
    }
    if (status.files.length === 0) {
      return <div className="empty-state">No uncommitted changes</div>;
    }
    return (
      <ul className="git-file-list">
        <li>
          <button
            type="button"
            className={`git-file-item${selectedPath === null ? " selected" : ""}`}
            onClick={() => handleSelectFile(null)}
          >
            <span className="git-file-status all-files">ALL</span>
            <span className="git-file-path">All files</span>
          </button>
        </li>
        {status.files.map((f) => (
          <li key={f.path}>
            <button
              type="button"
              className={`git-file-item${selectedPath === f.path ? " selected" : ""}`}
              onClick={() => handleSelectFile(f.path)}
            >
              <span className={`git-file-status status-${f.status}`}>{f.status}</span>
              <span className="git-file-path">{f.path}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={`page git-page${showDiff ? " show-diff" : ""}`}>
      <div className="git-status-panel">
        <h1 className="page-title">
          Git{status?.isGitRepo && status.files.length > 0 ? ` (${status.files.length})` : ""}
        </h1>
        {renderStatusContent()}
      </div>

      <div className="git-diff-panel">
        <div className="diff-header">
          <button type="button" className="btn-ghost back-btn" onClick={handleBack}>
            ← Back
          </button>
          <span className="diff-panel-title">{selectedPath ?? "All files"}</span>
        </div>
        {status && !status.isGitRepo ? (
          <div className="empty-state">Not a git repository</div>
        ) : (
          renderDiffContent()
        )}
      </div>
    </div>
  );
}
