/**
 * useResource: fetch-on-mount (+ refetch on live broadcast ticks) helper
 * for admin list pages. The fetcher is read through a ref, so inline
 * arrows are safe — refetch happens on mount, on live ticks, or when the
 * returned `refresh` is called. Never loops on re-renders.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveTick } from "./live";

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useResource<T>(fetcher: () => Promise<T>): ResourceState<T> {
  const liveTick = useLiveTick();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = refresh();
    return cancel;
  }, [refresh, liveTick]);

  return { data, loading, error, refresh };
}
