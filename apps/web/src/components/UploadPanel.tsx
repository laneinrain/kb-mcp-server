import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../types.js";
import { uploadFile, type UploadResult } from "../api/documents.js";

export interface UploadPanelProps {
  uploadFn?: (file: File) => Promise<UploadResult>;
  queryKey?: string[];
  hint?: string;
}

function uploadErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.body.error === "unsupported_media_type") {
      return "不支持的文件类型。请使用 .txt、.md、.markdown 或含可提取文本的 .pdf。";
    }
    if (
      err.body.error === "unprocessable_entity" ||
      err.message.includes("No sufficient text layer")
    ) {
      return "无法索引该 PDF：未检测到足够文字层。扫描版 PDF（纯图片）暂不支持，请使用可选中文字的电子版，或先用 OCR 转换后再上传。";
    }
    if (err.body.error === "payload_too_large") {
      return "文件过大（上限 50MB），请压缩或拆分后重试。";
    }
    if (err.status === 0) {
      return err.message;
    }
    return `请求失败：${err.message}`;
  }
  return err instanceof Error ? err.message : "上传失败";
}

export function UploadPanel({
  uploadFn = uploadFile,
  queryKey = ["documents"],
  hint,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => uploadFn(file),
    onSuccess: (data, file) => {
      setError(null);
      if (data.outcome === "unchanged") {
        setSuccess(`内容未变，跳过索引（${file.name}）`);
      } else if (data.outcome === "replaced") {
        setSuccess(`内容已更新并重新索引（${file.name}）`);
      } else {
        setSuccess(`已上传 ${file.name}`);
      }
      void queryClient.invalidateQueries({ queryKey });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setSuccess(null);
      setError(uploadErrorMessage(err));
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
      {hint ? <p className="muted admin-upload-hint">{hint}</p> : null}
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
