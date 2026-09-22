import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/themes"; // Import themes explicitly
import { Theme } from "./types";

// Load your environment key configuration safely
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Publishable Key. Please add VITE_CLERK_PUBLISHABLE_KEY to your .env file.",
  );
}

function Main() {
  const [theme, setTheme] = useState<Theme>("dark");
  return (
    <React.StrictMode>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        appearance={{
          // Maps seamlessly to dark mode if matched, otherwise falls back to standard light UI
          theme: theme === "dark" ? dark : undefined,
        }}
      >
        <BrowserRouter>
          <App theme={theme} setTheme={setTheme} />
        </BrowserRouter>
      </ClerkProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Main />);
