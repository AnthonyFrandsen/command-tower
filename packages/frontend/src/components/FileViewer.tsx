import { useState } from "react";
import Markdown from "./Markdown.js";
import "./FileViewer.css";

interface Props {
  path: string;
  content: string;
  onBack: () => void;
}

export default function FileViewer({ path, content, onBack }: Props) {
  const filename = path.split("/").pop() ?? path;
  const isMarkdown = filename.toLowerCase().endsWith(".md");
  const [renderMarkdown, setRenderMarkdown] = useState(true);
  const showMarkdown = isMarkdown && renderMarkdown;

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <button type="button" className="btn-ghost back-btn" onClick={onBack}>
          ← Back
        </button>
        <span className="file-viewer-name">{filename}</span>
        {isMarkdown && (
          <button
            type="button"
            className="btn-ghost md-toggle-btn"
            aria-pressed={renderMarkdown}
            onClick={() => setRenderMarkdown((prev) => !prev)}
          >
            {renderMarkdown ? "Raw" : "Preview"}
          </button>
        )}
      </div>
      {showMarkdown ? (
        <div className="file-viewer-content file-viewer-markdown">
          <Markdown text={content} />
        </div>
      ) : (
        <pre className="file-viewer-content">
          <code>{content}</code>
        </pre>
      )}
    </div>
  );
}
