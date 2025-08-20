"use client";

import * as React from "react";
import { TextField, type TextFieldProps } from "@mui/material";
import { useSocketInput, type CommitMode } from "./useSocketInput";

type UpdateFn<TAllowedUpdate, TEntry> = (
  patch: Partial<TAllowedUpdate>
) => Promise<TEntry | undefined | null> | Promise<unknown>;

export type SocketTextFieldProps<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
> = Omit<TextFieldProps, "value" | "onChange" | "onBlur"> & {
  state: TEntry | null;
  update: UpdateFn<TAllowedUpdate, TEntry>;
  property: TKey;
  commitMode?: CommitMode;
  debounceMs?: number;
  format?: (v: unknown) => unknown;
  parse?: (v: unknown) => unknown;
  onSuccess?: (entry: TEntry | undefined | null) => void;
  onError?: (error: string) => void;
  onChange?: TextFieldProps["onChange"];
  onBlur?: TextFieldProps["onBlur"];
};

export function SocketTextField<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
>(props: SocketTextFieldProps<TEntry, TAllowedUpdate, TKey>) {
  const {
    state,
    update,
    property,
    commitMode,
    debounceMs,
    format,
    parse,
    onSuccess,
    onError,
    onChange,
    onBlur,
    onKeyDown,
    disabled,
    ...mui
  } = props;

  const {
    value,
    onLocalChange,
    onBlur: handleBlur,
    onEnter,
    inFlight,
  } = useSocketInput<TEntry, TAllowedUpdate, TKey>({
    state,
    property,
    update,
    commitMode,
    debounceMs,
    format,
    parse,
    onSuccess,
    onError,
  });

  const mergedDisabled = Boolean(disabled) || inFlight;
  const filled =
    value !== undefined &&
    value !== null &&
    !(typeof value === "string" && value.length === 0);
  const inputLabelProps = React.useMemo(() => {
    return {
      ...mui.InputLabelProps,
      shrink: mui.InputLabelProps?.shrink ?? filled,
    } as TextFieldProps["InputLabelProps"];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mui.InputLabelProps, filled]);

  const handleChange = React.useCallback<
    NonNullable<TextFieldProps["onChange"]>
  >(
    (event) => {
      onChange?.(event);
      onLocalChange(event.target.value);
    },
    [onChange, onLocalChange]
  );

  const handleKeyDown = React.useCallback<
    NonNullable<TextFieldProps["onKeyDown"]>
  >(
    (event) => {
      onKeyDown?.(event);
      if (event.key === "Enter") {
        onEnter();
      }
    },
    [onKeyDown, onEnter]
  );

  const handleBlurWrapped = React.useCallback<
    NonNullable<TextFieldProps["onBlur"]>
  >(
    (event) => {
      onBlur?.(event);
      handleBlur();
    },
    [onBlur, handleBlur]
  );

  return (
    <TextField
      {...mui}
      value={
        value as unknown as string | number | readonly string[] | undefined
      }
      InputLabelProps={inputLabelProps}
      onChange={handleChange}
      onBlur={handleBlurWrapped}
      onKeyDown={handleKeyDown}
      disabled={mergedDisabled}
    />
  );
}
