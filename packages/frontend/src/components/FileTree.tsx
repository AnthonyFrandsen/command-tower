import type { FileEntry } from "../types.js";
import "./FileTree.css";

interface Props {
  entries: FileEntry[];
  onNavigate: (path: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileTree({ entries, onNavigate }: Props) {
  if (entries.length === 0) {
    return <div className="empty-state">Empty directory</div>;
  }

  return (
    <ul className="file-tree">
      {entries.map((entry) => (
        <li key={entry.path}>
          <button
            type="button"
            className={`file-entry ${entry.type === "directory" ? "is-dir" : "is-file"}`}
            onClick={() => onNavigate(entry.path)}
          >
            <span className="file-icon">{entry.type === "directory" ? "📁" : "📄"}</span>
            <span className="file-name">{entry.name}</span>
            {entry.size !== null && <span className="file-size">{formatSize(entry.size)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
