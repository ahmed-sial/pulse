import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Show, SignIn } from "@clerk/react";
import { Activity } from "lucide-react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { CommandPalette } from "./components/CommandPalette";
import { Overview } from "./pages/Overview";
import { Logs } from "./pages/Logs";
import { Queries } from "./pages/Queries";
import { Services } from "./pages/Services";
import { Alerts } from "./pages/Alerts";
import { Integrations } from "./pages/Integrations";
import { ApiKeys } from "./pages/ApiKeys";
import { Settings } from "./pages/Settings";
import type { Theme } from "./types";
import { Toaster } from "sonner";
import { LogFunction } from "./api/test";

function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  return (
    <>
      <Toaster theme={theme} richColors position="bottom-right" />
      <Show when="signed-out">
        <div className="auth-screen">
          <div className="auth-brand">
            <span className="brand-mark">
              <Activity size={17} />
            </span>
            <span>Pulse</span>
          </div>
          <SignIn />
        </div>
      </Show>

      <Show when="signed-in">
        <div className="app-shell">
          <Sidebar mobileNav={mobileNav} close={() => setMobileNav(false)} />
          <div className="app-main">
            <Header
              onMenu={() => setMobileNav(true)}
              onPalette={() => setPalette(true)}
              theme={theme}
              toggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
            <main className="content-pad">
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/queries" element={<Queries />} />
                <Route path="/services" element={<Services />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/api-keys" element={<ApiKeys />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
          {palette && <CommandPalette close={() => setPalette(false)} />}
        </div>
      </Show>
    </>
  );
}

export default App;
