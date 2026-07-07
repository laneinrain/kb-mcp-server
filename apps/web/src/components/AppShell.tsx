import { clearAccessToken, getCurrentEmployeeId } from "../lib/auth-token.js";

export type AppTab = "documents" | "search" | "settings" | "help" | "users";

interface AppShellProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  showAdminTab?: boolean;
  children: React.ReactNode;
}

const BASE_TABS: { id: AppTab; label: string }[] = [
  { id: "documents", label: "文档" },
  { id: "search", label: "搜索" },
  { id: "settings", label: "设置" },
  { id: "help", label: "使用说明" },
];

export function AppShell({
  activeTab,
  onTabChange,
  showAdminTab = false,
  children,
}: AppShellProps) {
  const tabs = showAdminTab
    ? [{ id: "users" as const, label: "用户管理" }, ...BASE_TABS]
    : BASE_TABS;

  const employeeId = getCurrentEmployeeId();

  function handleLogout() {
    clearAccessToken();
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">知识库管理</h1>
        {employeeId ? (
          <span className="header-employee-id muted">工号 {employeeId}</span>
        ) : null}
        <button
          type="button"
          className="btn btn-text logout-button"
          onClick={handleLogout}
        >
          退出登录
        </button>
      </header>
      <div className="tab-bar" role="tablist" aria-label="主导航">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-button${activeTab === tab.id ? " active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <main className="app-content">{children}</main>
    </div>
  );
}
