"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CommitMode = "change" | "blur" | "enter";

type UseSocketInputParams<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
> = {
  state: TEntry | null;
  property: TKey;
  update: (
    patch: Partial<TAllowedUpdate>
  ) => Promise<TEntry | undefined | null> | Promise<unknown>;
  commitMode?: CommitMode;
  debounceMs?: number;
  format?: (v: unknown) => unknown;
  parse?: (v: unknown) => unknown;
  onSuccess?: (entry: TEntry | undefined | null) => void;
  onError?: (error: string) => void;
};

type UseSocketInputReturn = {
  value: unknown;
  setValue: (v: unknown) => void;
  inFlight: boolean;
  onLocalChange: (v: unknown) => void;
  onBlur: () => void;
  onEnter: () => void;
};

export function useSocketInput<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
>(
  params: UseSocketInputParams<TEntry, TAllowedUpdate, TKey>
): UseSocketInputReturn {
  const {
    state,
    property,
    update,
    commitMode = "blur",
    debounceMs = 400,
    format,
    parse,
    onSuccess,
    onError,
  } = params;

  const remoteValue = useMemo(() => {
    const raw = state
      ? (state as Record<string, unknown>)[property as unknown as string]
      : undefined;
    return format ? format(raw) : raw;
  }, [state, property, format]);

  const [localValue, setLocalValue] = useState<unknown>(remoteValue);
  const [inFlight, setInFlight] = useState(false);
  const isEditingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<unknown | null>(null);

  // Keep local in sync with remote when not editing
  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalValue(remoteValue);
    }
  }, [remoteValue]);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const performCommit = useCallback(
    async (valueToCommit: unknown) => {
      setInFlight(true);
      try {
        const parsed = parse ? parse(valueToCommit) : valueToCommit;
        const patch = {
          [property as unknown as string]: parsed,
        } as unknown as Partial<TAllowedUpdate>;

        const result = (await update(patch)) as TEntry | undefined | null;
        onSuccess?.(result ?? null);
        isEditingRef.current = false;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Update failed (unknown error)";
        onError?.(message);
      } finally {
        setInFlight(false);
        // If there is a pending value, commit it now and clear the pending ref
        if (pendingValueRef.current !== null) {
          const next = pendingValueRef.current;
          pendingValueRef.current = null;
          void performCommit(next);
        }
      }
    },
    [parse, property, update, onSuccess, onError]
  );

  const commit = useCallback(
    (nextValue: unknown) => {
      if (inFlight) {
        // Queue the latest value; it will commit after current request finishes
        pendingValueRef.current = nextValue;
        return;
      }
      void performCommit(nextValue);
    },
    [inFlight, performCommit]
  );

  const onLocalChange = useCallback(
    (next: unknown) => {
      isEditingRef.current = true;
      setLocalValue(next);
      if (commitMode === "change") {
        clearDebounce();
        debounceTimerRef.current = setTimeout(() => {
          commit(next);
        }, debounceMs);
      }
    },
    [commitMode, debounceMs, clearDebounce, commit]
  );

  const onBlur = useCallback(() => {
    if (commitMode === "blur") {
      clearDebounce();
      commit(localValue);
    }
  }, [commitMode, localValue, clearDebounce, commit]);

  const onEnter = useCallback(() => {
    if (commitMode === "enter") {
      clearDebounce();
      commit(localValue);
    }
  }, [commitMode, localValue, clearDebounce, commit]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      clearDebounce();
    };
  }, [clearDebounce]);

  return {
    value: localValue,
    setValue: setLocalValue,
    inFlight,
    onLocalChange,
    onBlur,
    onEnter,
  };
}
