"use client";

import * as React from "react";
import { Slider, type SliderProps } from "@mui/material";
import { useSocketInput, type CommitMode } from "./useSocketInput";

type UpdateFn<TAllowedUpdate, TEntry> = (
  patch: Partial<TAllowedUpdate>
) => Promise<TEntry | undefined | null> | Promise<unknown>;

export type SocketSliderProps<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
> = Omit<SliderProps, "value" | "onChange" | "onChangeCommitted"> & {
  state: TEntry | null;
  update: UpdateFn<TAllowedUpdate, TEntry>;
  property: TKey; // numeric property
  commitMode?: CommitMode; // typically "change" or "blur"; for sliders, we also use onChangeCommitted
  debounceMs?: number;
  format?: (v: unknown) => unknown; // defaults to Number(value)
  parse?: (v: unknown) => unknown; // defaults to Number(value)
  onSuccess?: (entry: TEntry | undefined | null) => void;
  onError?: (error: string) => void;
  onChange?: SliderProps["onChange"];
  onChangeCommitted?: SliderProps["onChangeCommitted"];
};

export function SocketSlider<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
>(props: SocketSliderProps<TEntry, TAllowedUpdate, TKey>) {
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
    onChangeCommitted,
    disabled,
    ...mui
  } = props;

  const defaultFormat = React.useCallback((v: unknown) => {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }, []);
  const defaultParse = defaultFormat;

  const { value, onLocalChange, onBlur, inFlight } = useSocketInput<
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

  const handleChange = React.useCallback<NonNullable<SliderProps["onChange"]>>(
    (event, newValue, activeThumb) => {
      onChange?.(event, newValue, activeThumb);
      onLocalChange(newValue as number);
    },
    [onChange, onLocalChange]
  );

  const handleChangeCommitted = React.useCallback<
    NonNullable<SliderProps["onChangeCommitted"]>
  >(
    (event, newValue) => {
      onChangeCommitted?.(event, newValue);
      // For commit on release when not already committing on change
      if (commitMode !== "change") {
        onBlur();
      }
    },
    [onChangeCommitted, onBlur, commitMode]
  );

  return (
    <Slider
      {...mui}
      value={Number(value ?? 0)}
      onChange={handleChange}
      onChangeCommitted={handleChangeCommitted}
      disabled={mergedDisabled}
    />
  );
}
