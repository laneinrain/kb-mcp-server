export type AppTab = "documents" | "search" | "help";

interface AppShellProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: "documents", label: "文档" },
  { id: "search", label: "搜索" },
  { id: "help", label: "使用说明" },
];

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">知识库管理</h1>
      </header>
      <div className="tab-bar" role="tablist" aria-label="主导航">
        {TABS.map((tab) => (
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
