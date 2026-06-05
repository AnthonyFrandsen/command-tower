import { useEffect, useState } from "react";
import { getFiles } from "../api.js";
import FileTree from "../components/FileTree.js";
import FileViewer from "../components/FileViewer.js";
import type { DirectoryResult, FileResult } from "../types.js";
import "./FilesPage.css";

function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path === "" ? [] : path.split("/");
  return (
    <div className="breadcrumb">
      <button type="button" className="crumb" onClick={() => onNavigate("")}>
        workspace
      </button>
      {parts.map((part, i) => {
        const partPath = parts.slice(0, i + 1).join("/");
        return (
          <span key={partPath}>
            <span className="crumb-sep">/</span>
            <button type="button" className="crumb" onClick={() => onNavigate(partPath)}>
              {part}
            </button>
          </span>
        );
      })}
    </div>
  );
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [result, setResult] = useState<DirectoryResult | FileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getFiles(currentPath || undefined)
      .then((r) => {
        setResult(r);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentPath]);

  const navigate = (path: string) => {
    setCurrentPath(path);
    setResult(null);
  };

  const goBack = () => {
    const parts = currentPath.split("/");
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  return (
    <div className="page files-page">
      <div className="files-header">
        <h1 className="page-title">Files</h1>
        <Breadcrumb path={currentPath} onNavigate={navigate} />
      </div>

      {loading && (
        <div className="loading-row">
          <span className="spinner" /> Loading…
        </div>
      )}
      {error && <div className="error-message">{error}</div>}

      {!loading &&
        !error &&
        result &&
        (result.type === "directory" ? (
          <div className="card">
            <FileTree entries={result.entries} onNavigate={navigate} />
          </div>
        ) : (
          <FileViewer path={result.path} content={result.content} onBack={goBack} />
        ))}
    </div>
  );
}
