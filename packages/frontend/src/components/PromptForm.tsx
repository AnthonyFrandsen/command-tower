import { type FormEvent, useState } from "react";
import "./PromptForm.css";

const DRAFT_KEY = "command-tower:prompt-draft";

interface Props {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export default function PromptForm({ onSubmit, disabled = false }: Props) {
  const [value, setValue] = useState(() => localStorage.getItem(DRAFT_KEY) ?? "");

  const updateValue = (next: string) => {
    setValue(next);
    if (next) {
      localStorage.setItem(DRAFT_KEY, next);
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    updateValue("");
  };

  return (
    <form className="prompt-form" onSubmit={handleSubmit}>
      <textarea
        className="prompt-textarea"
        value={value}
        onChange={(e) => updateValue(e.target.value)}
        placeholder="Enter a prompt for the Claude Code agent…"
        rows={5}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit(e as unknown as FormEvent);
          }
        }}
      />
      <div className="prompt-footer">
        <span className="prompt-hint">
          {disabled ? "Agent is running…" : "⌘/Ctrl+Enter to submit"}
        </span>
        <button type="submit" className="btn-primary" disabled={disabled || !value.trim()}>
          {disabled ? (
            <>
              <span className="spinner" /> Running
            </>
          ) : (
            "Send"
          )}
        </button>
      </div>
    </form>
  );
}
