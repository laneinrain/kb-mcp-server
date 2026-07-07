import { useState } from "react";
import { register } from "../api/auth.js";
import { ApiError } from "../types.js";

export function RegisterPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!employeeId.trim()) {
      setError("请输入工号");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      await register(employeeId.trim(), password);
      setSuccess("注册成功，请登录");
      setTimeout(() => {
        window.location.href = "/login";
      }, 800);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message);
      } else {
        setError("注册失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card panel" onSubmit={handleSubmit}>
        <h1>注册</h1>
        <p className="login-hint">
          Mock 模式本地账户：工号 4–10 位数字，密码至少 8 位。注册后请使用相同凭据登录。
        </p>
        <div className="field">
          <label htmlFor="register-employee-id">工号</label>
          <input
            id="register-employee-id"
            name="employeeId"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="12345678"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="register-password">密码</label>
          <input
            id="register-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="field">
          <label htmlFor="register-confirm-password">确认密码</label>
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p className="banner-success">{success}</p> : null}
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "注册中…" : "注册"}
        </button>
        <p className="login-footer-link">
          已有账号？<a href="/login">返回登录</a>
        </p>
      </form>
    </div>
  );
}
