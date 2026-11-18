import { Suspense, type ReactNode } from "react";
import Spinner from "@/components/ui/Spinner";

// Pages are split into their own chunks (loaded on first visit). While one
// downloads, the shell (sidebar / tab bar) stays put and the content area
// shows a quiet spinner. Delayed so fast loads never flash it.
export function PageFallback() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-[50vh] animate-fadeInLate items-center justify-center">
      <Spinner size={28} />
    </div>
  );
}

export function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}
