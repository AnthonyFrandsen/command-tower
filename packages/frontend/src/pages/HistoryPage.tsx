import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteRun, getRun, listRuns } from "../api.js";
import OutputViewer from "../components/OutputViewer.js";
import RunCard from "../components/RunCard.js";
import type { Run, RunSummary } from "../types.js";
import "./HistoryPage.css";

export default function HistoryPage() {
  const { runId } = useParams<{ runId?: string }>();
  const navigate = useNavigate();

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    listRuns()
      .then(({ runs: r }) => setRuns(r))
      .catch((e: Error) => setListError(e.message))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    fetchList();
    // Poll for updates while any run is active
    const interval = setInterval(() => {
      fetchList();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchList]);

  useEffect(() => {
    if (!runId) {
      setSelectedRun(null);
      return;
    }
    setLoadingDetail(true);
    setDetailError(null);
    getRun(runId)
      .then(setSelectedRun)
      .catch((e: Error) => setDetailError(e.message))
      .finally(() => setLoadingDetail(false));
  }, [runId]);

  const handleSelect = (id: string) => {
    navigate(`/history/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this run?")) return;
    try {
      await deleteRun(id);
      setRuns((prev) => prev.filter((r) => r.runId !== id));
      if (runId === id) {
        navigate("/history");
      }
    } catch {
      // Silently ignore delete errors
    }
  };

  const showDetail = !!runId;

  return (
    <div className={`page history-page ${showDetail ? "has-detail" : ""}`}>
      {/* List panel — hidden on mobile when detail is open */}
      <div className="history-list-panel">
        <h1 className="page-title">History</h1>
        {loadingList && (
          <div className="loading-row">
            <span className="spinner" /> Loading…
          </div>
        )}
        {listError && <div className="error-msg">{listError}</div>}
        {!loadingList && runs.length === 0 && !listError && (
          <div className="empty-state">No runs yet. Go to Prompt to start one.</div>
        )}
        <div className="run-list">
          {runs.map((run) => (
            <RunCard
              key={run.runId}
              run={run}
              isSelected={run.runId === runId}
              onClick={() => handleSelect(run.runId)}
            />
          ))}
        </div>
      </div>

      {/* Detail panel — shown on mobile as full-screen overlay */}
      {showDetail && (
        <div className="history-detail-panel">
          <div className="detail-header">
            <button
              type="button"
              className="btn-ghost back-btn"
              onClick={() => navigate("/history")}
            >
              ← Back
            </button>
            {selectedRun && (
              <button
                type="button"
                className="btn-danger"
                style={{ fontSize: "0.8rem", padding: "6px 12px", minHeight: "36px" }}
                onClick={() => void handleDelete(selectedRun.runId)}
              >
                Delete
              </button>
            )}
          </div>

          {loadingDetail && (
            <div className="loading-row">
              <span className="spinner" /> Loading…
            </div>
          )}
          {detailError && <div className="error-msg">{detailError}</div>}
          {!loadingDetail && selectedRun && (
            <>
              <div className="detail-prompt card">
                <p className="detail-prompt-label">Prompt</p>
                <p className="detail-prompt-text">{selectedRun.prompt}</p>
              </div>
              <OutputViewer lines={[selectedRun.output]} status={selectedRun.status} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
