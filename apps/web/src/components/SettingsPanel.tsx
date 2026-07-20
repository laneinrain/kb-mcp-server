import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../types.js";
import { isAdminUser } from "../lib/auth-token.js";
import {
  fetchSettings,
  updateContextSettings,
  updateModelSettings,
  type ContextSettings,
  type ModelSettings,
} from "../api/settings.js";

const EMPTY_CONTEXT: ContextSettings = {
  readAroundWindowDefault: 1,
  readAroundWindowMax: 3,
  readAroundMaxChars: 32000,
  readFileMaxChunks: 50,
  readFileMaxChars: 64000,
};

const EMPTY_MODELS: ModelSettings = {
  embeddingModel: "",
  rerankEnabled: true,
  rerankModel: "",
  rerankCandidates: 30,
};

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    return `请求失败：${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "保存失败";
}

/** When login gate is off, model settings stay editable for local ops. */
function canEditModelSettings(): boolean {
  if (import.meta.env.VITE_USER_AUTH === "false") {
    return true;
  }
  return isAdminUser();
}

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const [contextForm, setContextForm] = useState<ContextSettings>(EMPTY_CONTEXT);
  const [modelForm, setModelForm] = useState<ModelSettings>(EMPTY_MODELS);
  const [savedEmbeddingModel, setSavedEmbeddingModel] = useState("");
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextSuccess, setContextSuccess] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelSuccess, setModelSuccess] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settingsQuery.data?.context) {
      setContextForm(settingsQuery.data.context);
    }
    if (settingsQuery.data?.models) {
      setModelForm(settingsQuery.data.models);
      setSavedEmbeddingModel(settingsQuery.data.models.embeddingModel);
    }
  }, [settingsQuery.data]);

  const contextMutation = useMutation({
    mutationFn: updateContextSettings,
    onSuccess: () => {
      setContextError(null);
      setContextSuccess("已保存上下文检索设置");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      setTimeout(() => setContextSuccess(null), 3000);
    },
    onError: (err) => {
      setContextSuccess(null);
      setContextError(formatError(err));
    },
  });

  const modelMutation = useMutation({
    mutationFn: updateModelSettings,
    onSuccess: (result) => {
      setModelError(null);
      setModelSuccess("已保存模型设置");
      setSavedEmbeddingModel(result.models.embeddingModel);
      setModelForm(result.models);
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      setTimeout(() => setModelSuccess(null), 3000);
    },
    onError: (err) => {
      setModelSuccess(null);
      setModelError(formatError(err));
    },
  });

  function updateContextField<K extends keyof ContextSettings>(
    key: K,
    value: ContextSettings[K],
  ) {
    setContextForm((current) => ({ ...current, [key]: value }));
  }

  function updateModelField<K extends keyof ModelSettings>(
    key: K,
    value: ModelSettings[K],
  ) {
    setModelForm((current) => ({ ...current, [key]: value }));
  }

  function onContextSubmit(event: FormEvent) {
    event.preventDefault();
    if (contextMutation.isPending) {
      return;
    }

    if (contextForm.readAroundWindowMax < contextForm.readAroundWindowDefault) {
      setContextSuccess(null);
      setContextError("最大窗口必须大于或等于默认窗口");
      return;
    }

    setContextError(null);
    contextMutation.mutate(contextForm);
  }

  function onModelSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEditModelSettings() || modelMutation.isPending) {
      return;
    }

    const embeddingModel = modelForm.embeddingModel.trim();
    const rerankModel = modelForm.rerankModel.trim();
    const { rerankCandidates, rerankEnabled } = modelForm;

    if (!embeddingModel) {
      setModelSuccess(null);
      setModelError("Embedding 模型不能为空");
      return;
    }
    if (!rerankModel) {
      setModelSuccess(null);
      setModelError("Rerank 模型不能为空");
      return;
    }
    if (
      !Number.isInteger(rerankCandidates) ||
      rerankCandidates < 1 ||
      rerankCandidates > 50
    ) {
      setModelSuccess(null);
      setModelError("召回候选条数须为 1–50 的整数");
      return;
    }

    setModelError(null);
    modelMutation.mutate({
      embeddingModel,
      rerankEnabled,
      rerankModel,
      rerankCandidates,
    });
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
  const embeddingDimensions = settingsQuery.data?.embeddingDimensions;
  const canEditModels = canEditModelSettings();
  const embeddingChanged =
    canEditModels &&
    modelForm.embeddingModel.trim() !== savedEmbeddingModel.trim() &&
    savedEmbeddingModel.trim() !== "";

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
        <h2>Embedding / Rerank</h2>
        <p className="muted">
          {canEditModels
            ? "检索所用模型（保存后对新的搜索立即生效）"
            : "检索所用模型（只读；仅管理员可修改 Embedding / Rerank）"}
        </p>
        <form className="search-form" onSubmit={onModelSubmit}>
          <div className="field">
            <label htmlFor="embedding-model">Embedding 模型</label>
            <input
              id="embedding-model"
              type="text"
              value={modelForm.embeddingModel}
              readOnly={!canEditModels}
              disabled={!canEditModels}
              onChange={(event) =>
                updateModelField("embeddingModel", event.target.value)
              }
              autoComplete="off"
            />
          </div>
          {embeddingChanged ? (
            <div className="banner-warning" role="status">
              更改 Embedding 模型后，已入库向量可能与新模型不兼容。建议对重要文档重新上传/入库；本系统不会自动重建
              Chroma 集合。
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="embedding-dimensions">向量维度（只读）</label>
            <input
              id="embedding-dimensions"
              type="number"
              value={embeddingDimensions ?? ""}
              readOnly
            />
            <p className="muted">
              由环境变量 <code className="mono">EMBEDDING_DIMENSIONS</code>{" "}
              决定，不可在此修改
            </p>
          </div>
          <div className="field">
            <label htmlFor="rerank-enabled">
              <input
                id="rerank-enabled"
                type="checkbox"
                checked={modelForm.rerankEnabled}
                disabled={!canEditModels}
                onChange={(event) =>
                  updateModelField("rerankEnabled", event.target.checked)
                }
              />{" "}
              启用 Rerank（两阶段精排）
            </label>
          </div>
          <div className="field">
            <label htmlFor="rerank-model">Rerank 模型</label>
            <input
              id="rerank-model"
              type="text"
              value={modelForm.rerankModel}
              disabled={!canEditModels || !modelForm.rerankEnabled}
              onChange={(event) =>
                updateModelField("rerankModel", event.target.value)
              }
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="rerank-candidates">召回候选条数</label>
            <input
              id="rerank-candidates"
              type="number"
              min={1}
              max={50}
              value={modelForm.rerankCandidates}
              disabled={!canEditModels || !modelForm.rerankEnabled}
              onChange={(event) =>
                updateModelField(
                  "rerankCandidates",
                  Number(event.target.value),
                )
              }
            />
            <p className="muted">向量召回条数（1–50），再精排为搜索 topK</p>
          </div>
          {canEditModels ? (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={modelMutation.isPending}
            >
              {modelMutation.isPending ? "保存中…" : "保存模型设置"}
            </button>
          ) : null}
        </form>
        {modelError ? <div className="banner-error">{modelError}</div> : null}
        {modelSuccess ? (
          <div className="banner-success">{modelSuccess}</div>
        ) : null}
      </section>

      <section>
        <h2>上下文检索</h2>
        <form className="search-form" onSubmit={onContextSubmit}>
          <div className="field">
            <label htmlFor="ctx-window-default">默认窗口 (±N)</label>
            <input
              id="ctx-window-default"
              type="number"
              min={1}
              max={10}
              value={contextForm.readAroundWindowDefault}
              onChange={(event) =>
                updateContextField(
                  "readAroundWindowDefault",
                  Number(event.target.value),
                )
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
              value={contextForm.readAroundWindowMax}
              onChange={(event) =>
                updateContextField(
                  "readAroundWindowMax",
                  Number(event.target.value),
                )
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
              value={contextForm.readAroundMaxChars}
              onChange={(event) =>
                updateContextField(
                  "readAroundMaxChars",
                  Number(event.target.value),
                )
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
              value={contextForm.readFileMaxChunks}
              onChange={(event) =>
                updateContextField(
                  "readFileMaxChunks",
                  Number(event.target.value),
                )
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
              value={contextForm.readFileMaxChars}
              onChange={(event) =>
                updateContextField(
                  "readFileMaxChars",
                  Number(event.target.value),
                )
              }
            />
            <p className="muted">超出时从文档末尾截断</p>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={contextMutation.isPending}
          >
            {contextMutation.isPending ? "保存中…" : "保存设置"}
          </button>
        </form>
        {contextError ? (
          <div className="banner-error">{contextError}</div>
        ) : null}
        {contextSuccess ? (
          <div className="banner-success">{contextSuccess}</div>
        ) : null}
      </section>
    </div>
  );
}
