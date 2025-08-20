"use client";

import * as React from "react";
import { Checkbox, type CheckboxProps } from "@mui/material";
import { useSocketInput, type CommitMode } from "./useSocketInput";

type UpdateFn<TAllowedUpdate, TEntry> = (
  patch: Partial<TAllowedUpdate>
) => Promise<TEntry | undefined | null> | Promise<unknown>;

export type SocketCheckboxProps<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
> = Omit<CheckboxProps, "checked" | "onChange"> & {
  state: TEntry | null;
  update: UpdateFn<TAllowedUpdate, TEntry>;
  property: TKey; // boolean property
  commitMode?: CommitMode; // typically "change"
  debounceMs?: number;
  format?: (v: unknown) => unknown; // defaults to Boolean(value)
  parse?: (v: unknown) => unknown; // defaults to Boolean(value)
  onSuccess?: (entry: TEntry | undefined | null) => void;
  onError?: (error: string) => void;
  onChange?: CheckboxProps["onChange"];
};

export function SocketCheckbox<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
>(props: SocketCheckboxProps<TEntry, TAllowedUpdate, TKey>) {
  const {
    state,
    update,
    property,
    commitMode = "change",
    debounceMs,
    format,
    parse,
    onSuccess,
    onError,
    onChange,
    disabled,
    ...mui
  } = props;

  const defaultFormat = React.useCallback((v: unknown) => Boolean(v), []);
  const defaultParse = React.useCallback((v: unknown) => Boolean(v), []);

  const { value, onLocalChange, inFlight } = useSocketInput<
    TEntry,
    TAllowedUpdate,
    TKey
  >({
    state,
    property,
    update,
    commitMode,
    debounceMs,
    format: format ?? defaultFormat,
    parse: parse ?? defaultParse,
    onSuccess,
    onError,
  });

  const mergedDisabled = Boolean(disabled) || inFlight;

  const handleChange = React.useCallback<
    NonNullable<CheckboxProps["onChange"]>
  >(
    (event, checked) => {
      onChange?.(event, checked);
      onLocalChange(checked);
    },
    [onChange, onLocalChange]
  );

  return (
    <Checkbox
      {...mui}
      checked={Boolean(value)}
      onChange={handleChange}
      disabled={mergedDisabled}
    />
  );
}
