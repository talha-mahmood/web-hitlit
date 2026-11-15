import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ConfigErrorPage from "./pages/ConfigErrorPage";

const root = createRoot(document.getElementById("root")!);

// After a deploy, a tab opened on the previous build may ask for page chunks
// that no longer exist. Reload once to pick up the new build instead of
// showing a broken page (guarded so it can never loop).
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem("hitlit.chunkReload") ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem("hitlit.chunkReload", String(Date.now()));
  } catch {
    // Storage blocked: still reload, the browser's own cache rules apply.
  }
  event.preventDefault();
  window.location.reload();
});

// Offline support + "Install app" (see src/sw/sw.js). Production builds only,
// so local development never serves stale files.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// The shared Supabase client throws at import time when it isn't configured
// (same as the app). Check first and show a readable setup screen instead of
// a blank page, then load the real app.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  root.render(<ConfigErrorPage />);
} else {
  import("./App").then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}
