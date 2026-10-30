import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { eventRefreshAt } from "./eventPresentation";
import { ApiError } from "../../api/errors";
import { eventsApi } from "../../api/endpoints/events";
import type { EventPageDto, EventQuery } from "../../types/events";

type FeedState = "loading" | "ready" | "error" | "disabled";
const emptyPage: EventPageDto = { items: [], nextCursor: null, places: [], placesStatus: null };

export function useEventsFeed(query: EventQuery) {
  const [page, setPage] = useState(emptyPage);
  const [pageQuery, setPageQuery] = useState(query);
  const [state, setState] = useState<FeedState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const sequence = useRef(0);
  const receivedAt = useRef(new Map<string, number>());
  const focused = useRef(false);
  const pending = useRef<{ query: EventQuery; cursor?: string } | null>(null);
  const failedCursor = useRef<string | undefined>(undefined);

  const load = useCallback(
    async (cursor?: string) => {
      if (pending.current?.query === query && (cursor || !pending.current.cursor)) return;
      const request = ++sequence.current;
      pending.current = { query, cursor };
      setBusy(true);
      setError(null);
      // Never display places while refreshing or when a request fails.
      setPage((previous) => ({ ...previous, places: [], placesStatus: null }));
      if (!cursor) setState("loading");
      try {
        if (!cursor) {
          const status = await eventsApi.status();
          if (request !== sequence.current) return;
          if (!status.enabled) {
            setPageQuery(query);
            setPage(emptyPage);
            setState("disabled");
            return;
          }
        }
        const result = await eventsApi.list({ ...query, cursor });
        if (request !== sequence.current) return;
        if (!cursor) receivedAt.current.clear();
        const now = Date.now();
        for (const item of result.items) {
          if (!cursor || !receivedAt.current.has(item.id)) receivedAt.current.set(item.id, now);
        }
        setPageQuery(query);
        setPage((previous) =>
          cursor
            ? {
                ...result,
                places: [],
                placesStatus: null,
                items: [
                  ...previous.items,
                  ...result.items.filter(
                    (item) => !previous.items.some((old) => old.id === item.id),
                  ),
                ],
              }
            : result,
        );
        failedCursor.current = undefined;
        setState("ready");
      } catch (cause) {
        if (request !== sequence.current) return;
        setPageQuery(query);
        const denied = cause instanceof ApiError && [401, 403, 404].includes(cause.status);
        if (denied) setPage(emptyPage);
        failedCursor.current = denied ? undefined : cursor;
        setError(cause);
        setState("error");
      } finally {
        if (request === sequence.current) {
          pending.current = null;
          setBusy(false);
        }
      }
    },
    [query],
  );

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setPage(emptyPage);
      void load();
      const listener = AppState.addEventListener("change", (next) => {
        if (next === "active") void load();
        else {
          sequence.current += 1;
          pending.current = null;
          setPage(emptyPage);
          setBusy(false);
          setState("loading");
        }
      });
      return () => {
        focused.current = false;
        listener.remove();
        sequence.current += 1;
        pending.current = null;
        setPage(emptyPage);
      };
    }, [load]),
  );

  useEffect(() => {
    if (pageQuery !== query || state !== "ready" || !focused.current) return;
    const deadlines = page.items.map(item => eventRefreshAt(item, receivedAt.current.get(item.id) ?? Date.now())).filter((value): value is number => value !== null);
    if (!deadlines.length) return;
    const timer = setTimeout(() => { if (focused.current && AppState.currentState === "active") void load(); }, Math.max(1, Math.min(2147483647, Math.min(...deadlines) - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [page, pageQuery, query, state, load]);

  return {
    page: pageQuery === query ? page : emptyPage,
    state: pageQuery === query ? state : ("loading" as FeedState),
    busy,
    error,
    refresh: () => load(),
    more: () => (page.nextCursor ? load(page.nextCursor) : Promise.resolve()),
    retry: () => load(failedCursor.current),
  };
}
