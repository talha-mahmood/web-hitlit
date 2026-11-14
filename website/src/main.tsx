import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ConfigErrorPage from "./pages/ConfigErrorPage";

const root = createRoot(document.getElementById("root")!);

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
