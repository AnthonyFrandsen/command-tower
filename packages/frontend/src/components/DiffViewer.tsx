import "./DiffViewer.css";

interface DiffViewerProps {
  diff: string;
  loading?: boolean;
}

export default function DiffViewer({ diff, loading }: DiffViewerProps) {
  if (loading) {
    return (
      <div className="loading-row">
        <span className="spinner" /> Loading…
      </div>
    );
  }

  const lines = diff.split("\n");

  return (
    <pre className="diff-viewer">
      {lines.map((line, i) => {
        let className = "";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          className = "diff-add";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          className = "diff-del";
        } else if (line.startsWith("@@")) {
          className = "diff-hunk";
        } else if (
          line.startsWith("diff --git") ||
          line.startsWith("index ") ||
          line.startsWith("---") ||
          line.startsWith("+++")
        ) {
          className = "diff-meta";
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable ordering in a read-only diff
          <span key={i} className={className || undefined}>
            {line}
            {"\n"}
          </span>
        );
      })}
    </pre>
  );
}
