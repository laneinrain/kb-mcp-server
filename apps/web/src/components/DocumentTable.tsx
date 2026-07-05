import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type DocumentRecord } from "../types.js";
import { deleteDocument, listDocuments } from "../api/documents.js";
import { displayFilename } from "../lib/filename.js";
import { CopyIdButton } from "./CopyIdButton.js";

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function statusLabel(status: DocumentRecord["status"]): string {
  switch (status) {
    case "indexed":
      return "已索引";
    case "pending":
      return "等待中";
    case "processing":
      return "处理中";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

function statusClass(status: DocumentRecord["status"]): string {
  if (status === "indexed") {
    return "badge badge-indexed";
  }
  if (status === "failed") {
    return "badge badge-failed";
  }
  return "badge badge-pending";
}

export function DocumentTable() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(
    null,
  );
  const [modalError, setModalError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      setPendingDelete(null);
      setModalError(null);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => {
      setModalError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "删除失败",
      );
    },
  });

  if (isLoading) {
    return <p className="muted">加载中…</p>;
  }

  if (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "加载失败";
    return (
      <div className="banner-error">
        请求失败：{message}。请确认后端已启动（pnpm dev）并重试。
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="empty-state">
        <h3>暂无文档</h3>
        <p>上传 .txt、.md 或含可提取文本的 PDF，即可建立知识库索引。</p>
      </div>
    );
  }

  return (
    <>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>文件名</th>
              <th>ID</th>
              <th>状态</th>
              <th>分块数</th>
              <th>集合</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((doc) => {
              const filename = displayFilename(doc.filename);
              return (
                <tr key={doc.id}>
                  <td className="filename-cell" title={filename}>
                    {filename}
                  </td>
                  <td>
                    <CopyIdButton id={doc.id} />
                  </td>
                  <td>
                    <span className={statusClass(doc.status)}>
                      {statusLabel(doc.status)}
                    </span>
                  </td>
                  <td>{doc.chunkCount}</td>
                  <td className="muted">{doc.collection}</td>
                  <td className="muted">{formatDate(doc.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-text-destructive"
                      aria-label={`Delete ${filename}`}
                      onClick={() => {
                        setModalError(null);
                        setPendingDelete(doc);
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendingDelete ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h2>删除文档</h2>
            <p>
              确定删除「{displayFilename(pendingDelete.filename)}」及其全部向量吗？此操作不可撤销。
            </p>
            {modalError ? (
              <p className="inline-error">请求失败：{modalError}</p>
            ) : null}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteMutation.isPending}
                onClick={() => setPendingDelete(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(pendingDelete.id)}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
