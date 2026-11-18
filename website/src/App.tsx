import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import RootGate from "./routes/RootGate";
import AlertHost from "./components/ui/AlertHost";
import ThemeRoot from "./components/ThemeRoot";

// Same defaults as the app's QueryClient.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeRoot>
          <RootGate />
          <AlertHost />
        </ThemeRoot>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
