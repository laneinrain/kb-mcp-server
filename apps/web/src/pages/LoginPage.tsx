import { useState } from "react";
import { login } from "../api/auth.js";
import { ApiError } from "../types.js";
import { setAccessToken, setCurrentUserId } from "../lib/auth-token.js";

export function LoginPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!employeeId.trim()) {
      setError("请输入工号");
      return;
    }
    if (!password.trim()) {
      setError("请输入密码");
      return;
    }

    setLoading(true);
    try {
      const result = await login(employeeId.trim(), password);
      setAccessToken(result.accessToken);
      setCurrentUserId(result.user.id);
      window.location.href = "/";
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message);
      } else {
        setError("登录失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card panel" onSubmit={handleSubmit}>
        <h1>登录</h1>
        <p className="login-hint">
          开发环境 CAS 模拟：合法工号（4–10 位数字）+ 任意非空密码即可登录。
        </p>
        <div className="field">
          <label htmlFor="employee-id">工号</label>
          <input
            id="employee-id"
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
          <label htmlFor="password">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}
