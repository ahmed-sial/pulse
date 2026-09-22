import { CircleHelp, Menu, Moon, Search, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import type { Theme } from "../../types";

export function Header({
  onMenu,
  onPalette,
  theme,
  toggleTheme,
}: {
  onMenu: () => void;
  onPalette: () => void;
  theme: Theme;
  toggleTheme: () => void;
}) {
  const loc = useLocation();
  const title =
    loc.pathname === "/" ? "Overview" : loc.pathname.slice(1).replace("-", " ");
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenu}>
        <Menu size={19} />
      </button>
      <div className="crumb">
        <span>Pulse</span>
        <span>/</span>
        <strong>{title}</strong>
      </div>
      <div className="header-actions">
        <button className="command-trigger" onClick={onPalette}>
          <Search size={15} />
          <span>Search logs or jump to...</span>
          <kbd>⌘ K</kbd>
        </button>
        <button
          className="icon-btn"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="icon-btn">
          <CircleHelp size={17} />
        </button>
        <div className="status-pill">
          <i />
          All systems operational
        </div>
      </div>
    </header>
  );
}
