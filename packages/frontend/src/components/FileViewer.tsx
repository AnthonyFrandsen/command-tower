import "./FileViewer.css";

interface Props {
  path: string;
  content: string;
  onBack: () => void;
}

export default function FileViewer({ path, content, onBack }: Props) {
  const filename = path.split("/").pop() ?? path;

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <button type="button" className="btn-ghost back-btn" onClick={onBack}>
          ← Back
        </button>
        <span className="file-viewer-name">{filename}</span>
      </div>
      <pre className="file-viewer-content">
        <code>{content}</code>
      </pre>
    </div>
  );
}
