import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, type SearchResultItem } from "../types.js";
import { searchDocuments } from "../api/search.js";

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => searchDocuments(query.trim(), topK),
    onSuccess: (data) => {
      setError(null);
      setResults(data);
    },
    onError: (err) => {
      setResults([]);
      setError(
        err instanceof ApiError
          ? `请求失败：${err.message}`
          : err instanceof Error
            ? err.message
            : "搜索失败",
      );
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || mutation.isPending) {
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="panel-stack">
      <form className="search-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="search-query">查询</label>
          <textarea
            id="search-query"
            rows={3}
            maxLength={2000}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入要搜索的问题…"
          />
        </div>
        <div className="field">
          <label htmlFor="search-topk">返回条数</label>
          <select
            id="search-topk"
            value={topK}
            onChange={(event) => setTopK(Number(event.target.value))}
          >
            {Array.from({ length: 10 }, (_, index) => index + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!query.trim() || mutation.isPending}
        >
          {mutation.isPending ? "搜索中…" : "运行搜索"}
        </button>
      </form>

      {error ? <div className="banner-error">{error}</div> : null}

      {mutation.isSuccess && results.length === 0 ? (
        <div className="empty-state">
          <h3>无结果</h3>
          <p>输入查询并运行搜索，即可预览语料库中的相关片段。</p>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="result-list">
          {results.map((item, index) => (
            <article
              key={`${item.documentId}-${item.chunkIndex}-${index}`}
              className="result-card"
            >
              <div className="result-meta">
                <span className="result-score">
                  分数 {item.score.toFixed(3)}
                </span>
                {" · "}
                {item.filename} · 块 {item.chunkIndex}
                <br />
                <span className="mono">ID {truncateId(item.documentId)}</span>
              </div>
              <pre className="result-snippet">{item.text}</pre>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function truncateId(id: string): string {
  if (id.length <= 16) {
    return id;
  }
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}
