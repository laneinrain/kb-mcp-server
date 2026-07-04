import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../types.js";
import { uploadFile } from "../api/documents.js";

export function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => uploadFile(file),
    onSuccess: (_data, file) => {
      setError(null);
      setSuccess(`已上传 ${file.name}`);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setSuccess(null);
      if (err instanceof ApiError) {
        if (err.body.error === "unsupported_media_type") {
          setError(
            "不支持的文件类型。请使用 .txt、.md、.markdown 或含可提取文本的 .pdf。",
          );
          return;
        }
        setError(`请求失败：${err.message}。请确认后端已启动并重试。`);
        return;
      }
      setError(err instanceof Error ? err.message : "上传失败");
    },
  });

  function pickFile() {
    inputRef.current?.click();
  }

  function handleFile(file: File | undefined) {
    if (!file || mutation.isPending) {
      return;
    }
    setError(null);
    setSuccess(null);
    mutation.mutate(file);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files[0]);
  }

  return (
    <section>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.markdown,.pdf"
        hidden
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <div
        className={`upload-zone${dragOver ? " drag-over" : ""}${mutation.isPending ? " disabled" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {mutation.isPending ? (
          <>
            <strong>索引中…</strong>
            <span className="muted">大型 PDF 可能需要一分钟。</span>
          </>
        ) : (
          <>
            <p>将文件拖到此处，或</p>
            <button type="button" className="btn btn-primary" onClick={pickFile}>
              选择文件
            </button>
            <span className="muted">支持 .txt / .md / .pdf</span>
          </>
        )}
      </div>
      {error ? <div className="banner-error">{error}</div> : null}
      {success ? <div className="banner-success">{success}</div> : null}
    </section>
  );
}
