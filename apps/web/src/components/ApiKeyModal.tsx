interface ApiKeyModalProps {
  open: boolean;
  invalid?: boolean;
  onCancel: () => void;
  onSave: (key: string) => void;
}

export function ApiKeyModal({
  open,
  invalid,
  onCancel,
  onSave,
}: ApiKeyModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const input = form.elements.namedItem("apiKey") as HTMLInputElement;
          onSave(input.value.trim());
        }}
      >
        <h2>需要 API 密钥</h2>
        <p>
          请输入服务端配置的 API 密钥（AUTH_ENABLED）。密钥仅保存在当前浏览器标签页的
          sessionStorage（kb_api_key）中。
        </p>
        <div className="field">
          <label htmlFor="api-key-input">API 密钥</label>
          <input
            id="api-key-input"
            name="apiKey"
            type="password"
            autoComplete="off"
            required
          />
          {invalid ? (
            <p className="inline-error">API 密钥无效，请重试。</p>
          ) : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            保存密钥
          </button>
        </div>
      </form>
    </div>
  );
}
