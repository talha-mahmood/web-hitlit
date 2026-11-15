// Shown instead of a blank page when the build has no Supabase settings.
export default function ConfigErrorPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-hero">
        <img src="/logo.png" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-4 text-xl font-extrabold text-ink">HitLit isn't configured yet</h1>
        <p className="mt-2 text-sm text-muted">
          Add <code className="rounded bg-gray-100 px-1">VITE_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-gray-100 px-1">VITE_SUPABASE_ANON_KEY</code> to{" "}
          <code className="rounded bg-gray-100 px-1">website/.env</code> (same values as the app's
          EXPO_PUBLIC_ ones), then restart.
        </p>
      </div>
    </div>
  );
}
