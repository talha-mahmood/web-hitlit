import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

// A text input mirrored into a URL query param. The input is driven by local
// state (typing must never wait on a router update, or fast keystrokes get
// dropped); the URL catches up after `delay` ms. Back/forward or a pasted
// link that changes the param externally flows back into the input.
export function useUrlTextParam(key: string, delay = 300): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const urlValue = params.get(key) ?? "";
  const [value, setValue] = useState(urlValue);
  const lastWritten = useRef(urlValue);

  useEffect(() => {
    if (urlValue !== lastWritten.current) {
      lastWritten.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    if (value === lastWritten.current) return;
    const t = setTimeout(() => {
      lastWritten.current = value;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true, preventScrollReset: true, state: window.history.state?.usr }
      );
    }, delay);
    return () => clearTimeout(t);
  }, [value, key, delay, setParams]);

  return [value, setValue];
}
