import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { LoginPage } from "./pages/LoginPage.js";
import { hasAccessToken } from "./lib/auth-token.js";
import "./App.css";

function userAuthGateEnabled(): boolean {
  return import.meta.env.VITE_USER_AUTH !== "false";
}

function Root() {
  if (!userAuthGateEnabled()) {
    return <App />;
  }

  const path = window.location.pathname;
  if (path === "/login") {
    if (hasAccessToken()) {
      window.location.replace("/");
      return null;
    }
    return <LoginPage />;
  }

  if (!hasAccessToken()) {
    window.location.replace("/login");
    return null;
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
