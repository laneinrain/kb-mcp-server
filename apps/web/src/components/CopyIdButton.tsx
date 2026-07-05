import { useState } from "react";

interface CopyIdButtonProps {
  id: string;
}

export function CopyIdButton({ id }: CopyIdButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard may be unavailable
    }
  }

  return (
    <div className="id-cell">
      <span className="mono id-text" title={id}>
        {id}
      </span>
      <button
        type="button"
        className="btn btn-copy-id"
        onClick={() => void copyId()}
        title="复制 ID"
        aria-label={`复制 ID ${id}`}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}
