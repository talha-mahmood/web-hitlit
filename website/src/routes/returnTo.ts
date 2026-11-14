import { createElement, useEffect, useState } from "react";
import { Navigate } from "react-router";

// Remembers the page a signed-out visitor was trying to open (e.g. a shared
// /comment/<id> link) across the OAuth redirect, so sign-in lands them there.
const KEY = "hitlit:return-to";

export function rememberReturnTo(path: string) {
  try {
    if (path && path !== "/" && !path.startsWith("/auth")) sessionStorage.setItem(KEY, path);
  } catch {
    // storage blocked — they'll just land on Home
  }
}

// Read without clearing — render/effects may run twice in StrictMode.
export function peekReturnTo(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearReturnTo() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Rendered at /auth/callback once a session exists: go to the remembered page.
export function AuthCallbackRedirect() {
  const [target] = useState(() => peekReturnTo() ?? "/");
  useEffect(() => clearReturnTo(), []);
  return createElement(Navigate, { to: target, replace: true });
}
