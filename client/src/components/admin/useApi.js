import { useCallback, useEffect, useRef, useState } from "react";

/** Small data-loading hook: { data, loading, error, reload }. Ignores stale responses. */
export function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);

  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fetcher)
      .then((res) => id === seq.current && setState({ data: res?.data ?? res, loading: false, error: null }))
      .catch((err) =>
        id === seq.current &&
        setState({ data: null, loading: false, error: err?.response?.data?.message || err.message || "Request failed" }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}

export const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : n ?? "–");
