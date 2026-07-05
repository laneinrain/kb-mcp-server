import { useCallback, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setUnauthorizedHandler } from "./api/client.js";
import { AppShell, type AppTab } from "./components/AppShell.js";
import { ApiKeyModal } from "./components/ApiKeyModal.js";
import { DocumentTable } from "./components/DocumentTable.js";
import { HelpPanel } from "./components/HelpPanel.js";
import { SearchPanel } from "./components/SearchPanel.js";
import { SettingsPanel } from "./components/SettingsPanel.js";
import { UploadPanel } from "./components/UploadPanel.js";

const queryClient = new QueryClient();

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("documents");
  const [modalOpen, setModalOpen] = useState(false);
  const [invalidKey, setInvalidKey] = useState(false);
  const resolverRef = useRef<((key: string | null) => void) | null>(null);

  const handleUnauthorized = useCallback(
    (invalid: boolean): Promise<string | null> => {
      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setInvalidKey(invalid);
        setModalOpen(true);
      });
    },
    [],
  );

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  function resolveModal(key: string | null) {
    resolverRef.current?.(key);
    resolverRef.current = null;
    setModalOpen(false);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
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
      <ApiKeyModal
        open={modalOpen}
        invalid={invalidKey}
        onCancel={() => resolveModal(null)}
        onSave={(key) => {
          if (!key) {
            setInvalidKey(true);
            return;
          }
          resolveModal(key);
        }}
      />
    </QueryClientProvider>
  );
}
