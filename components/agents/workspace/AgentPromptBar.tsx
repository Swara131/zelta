"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useId } from "react";

interface AgentPromptBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  minLength?: number;
}

export default function AgentPromptBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  loading = false,
  placeholder = "What do you want your agent to do?",
  minLength = 15,
}: AgentPromptBarProps) {
  const inputId = useId();
  const trimmed = value.trim();
  const canSubmit = trimmed.length >= minLength && !disabled && !loading;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  return (
    <div className="zws-prompt-wrap">
      <label className="sr-only" htmlFor={inputId}>
        Describe what you want your agent to do
      </label>
      <div className={`zws-prompt ${loading ? "is-loading" : ""}`}>
        <textarea
          id={inputId}
          className="zws-prompt-input"
          rows={2}
          value={value}
          placeholder={placeholder}
          disabled={disabled || loading}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby={`${inputId}-hint`}
        />
        <button
          type="button"
          className="zws-prompt-submit"
          disabled={!canSubmit}
          aria-label={loading ? "Building agent" : "Create agent"}
          onClick={onSubmit}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          )}
        </button>
      </div>
      <p id={`${inputId}-hint`} className="zws-prompt-hint">
        Press Enter to submit · Shift+Enter for a new line
        {trimmed.length > 0 && trimmed.length < minLength
          ? ` · Add ${minLength - trimmed.length} more character${minLength - trimmed.length === 1 ? "" : "s"}`
          : ""}
      </p>
    </div>
  );
}
