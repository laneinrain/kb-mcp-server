import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../types.js";
import {
  fetchSettings,
  updateContextSettings,
  type ContextSettings,
} from "../api/settings.js";

const EMPTY_CONTEXT: ContextSettings = {
  readAroundWindowDefault: 1,
  readAroundWindowMax: 3,
  readAroundMaxChars: 32000,
  readFileMaxChunks: 50,
  readFileMaxChars: 64000,
};

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContextSettings>(EMPTY_CONTEXT);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settingsQuery.data?.context) {
      setForm(settingsQuery.data.context);
    }
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: updateContextSettings,
    onSuccess: () => {
      setError(null);
      setSuccess("已保存上下文检索设置");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setSuccess(null);
      setError(
        err instanceof ApiError
          ? `请求失败：${err.message}`
          : err instanceof Error
            ? err.message
            : "保存失败",
      );
    },
  });

  function updateField<K extends keyof ContextSettings>(
    key: K,
    value: ContextSettings[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mutation.isPending) {
      return;
    }

    if (form.readAroundWindowMax < form.readAroundWindowDefault) {
      setSuccess(null);
      setError("最大窗口必须大于或等于默认窗口");
      return;
    }

    setError(null);
    mutation.mutate(form);
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="panel-stack">
        <p className="muted">加载设置中…</p>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="panel-stack">
        <div className="banner-error">
          {settingsQuery.error instanceof ApiError
            ? `请求失败：${settingsQuery.error.message}`
            : "无法加载设置"}
        </div>
      </div>
    );
  }

  const chunk = settingsQuery.data?.chunk;

  return (
    <div className="panel-stack">
      <section>
        <h2>分块</h2>
        <p className="muted">入库分块参数（只读）</p>
        <div className="field">
          <label htmlFor="chunk-size">块大小</label>
          <input
            id="chunk-size"
            type="number"
            value={chunk?.chunkSize ?? ""}
            readOnly
          />
        </div>
        <div className="field">
          <label htmlFor="chunk-overlap">块重叠</label>
          <input
            id="chunk-overlap"
            type="number"
            value={chunk?.chunkOverlap ?? ""}
            readOnly
          />
        </div>
      </section>

      <section>
        <h2>上下文检索</h2>
        <form className="search-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="ctx-window-default">默认窗口 (±N)</label>
            <input
              id="ctx-window-default"
              type="number"
              min={1}
              max={10}
              value={form.readAroundWindowDefault}
              onChange={(event) =>
                updateField("readAroundWindowDefault", Number(event.target.value))
              }
            />
            <p className="muted">未指定时 read_around 使用的邻块数</p>
          </div>
          <div className="field">
            <label htmlFor="ctx-window-max">最大窗口 (±N)</label>
            <input
              id="ctx-window-max"
              type="number"
              min={1}
              max={10}
              value={form.readAroundWindowMax}
              onChange={(event) =>
                updateField("readAroundWindowMax", Number(event.target.value))
              }
            />
            <p className="muted">请求超出时自动限制到此值</p>
          </div>
          <div className="field">
            <label htmlFor="ctx-max-chars">read_around 最大字符数</label>
            <input
              id="ctx-max-chars"
              type="number"
              min={1000}
              value={form.readAroundMaxChars}
              onChange={(event) =>
                updateField("readAroundMaxChars", Number(event.target.value))
              }
            />
            <p className="muted">超出时从窗口远端截断</p>
          </div>
          <div className="field">
            <label htmlFor="ctx-file-max-chunks">read_file 最大块数</label>
            <input
              id="ctx-file-max-chunks"
              type="number"
              min={1}
              value={form.readFileMaxChunks}
              onChange={(event) =>
                updateField("readFileMaxChunks", Number(event.target.value))
              }
            />
            <p className="muted">超出时从文档末尾截断</p>
          </div>
          <div className="field">
            <label htmlFor="ctx-file-max-chars">read_file 最大字符数</label>
            <input
              id="ctx-file-max-chars"
              type="number"
              min={1000}
              value={form.readFileMaxChars}
              onChange={(event) =>
                updateField("readFileMaxChars", Number(event.target.value))
              }
            />
            <p className="muted">超出时从文档末尾截断</p>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "保存中…" : "保存设置"}
          </button>
        </form>
      </section>

      {error ? <div className="banner-error">{error}</div> : null}
      {success ? <div className="banner-success">{success}</div> : null}
    </div>
  );
}
