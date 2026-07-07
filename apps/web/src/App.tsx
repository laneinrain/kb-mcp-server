import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell, type AppTab } from "./components/AppShell.js";
import { AdminUsersPanel } from "./components/AdminUsersPanel.js";
import { DocumentTable } from "./components/DocumentTable.js";
import { HelpPanel } from "./components/HelpPanel.js";
import { SearchPanel } from "./components/SearchPanel.js";
import { SettingsPanel } from "./components/SettingsPanel.js";
import { UploadPanel } from "./components/UploadPanel.js";
import { isAdminUser } from "./lib/auth-token.js";

const queryClient = new QueryClient();

export function App() {
  const showAdminTab = isAdminUser();
  const [activeTab, setActiveTab] = useState<AppTab>(
    showAdminTab ? "users" : "documents",
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showAdminTab={showAdminTab}
      >
        {activeTab === "users" && showAdminTab ? <AdminUsersPanel /> : null}
        {activeTab === "documents" ? (
          <div className="panel-stack">
            <UploadPanel />
            <DocumentTable />
          </div>
        ) : null}
        {activeTab === "search" ? <SearchPanel /> : null}
        {activeTab === "settings" ? <SettingsPanel /> : null}
        {activeTab === "help" ? <HelpPanel /> : null}
      </AppShell>
    </QueryClientProvider>
  );
}
