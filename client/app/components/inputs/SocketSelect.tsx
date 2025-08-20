"use client";

import * as React from "react";
import {
  Select,
  MenuItem,
  type SelectProps,
  type MenuItemProps,
  FormControl,
  InputLabel,
  FormHelperText,
} from "@mui/material";
import { useSocketInput, type CommitMode } from "./useSocketInput";

type UpdateFn<TAllowedUpdate, TEntry> = (
  patch: Partial<TAllowedUpdate>
) => Promise<TEntry | undefined | null> | Promise<unknown>;

export type SelectOption = { label: string; value: string | number };

export type SocketSelectProps<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
> = Omit<SelectProps, "value" | "onChange" | "onBlur" | "label"> & {
  state: TEntry | null;
  update: UpdateFn<TAllowedUpdate, TEntry>;
  property: TKey;
  options: SelectOption[];
  label?: string;
  commitMode?: CommitMode; // change or blur
  debounceMs?: number;
  format?: (v: unknown) => unknown;
  parse?: (v: unknown) => unknown;
  onSuccess?: (entry: TEntry | undefined | null) => void;
  onError?: (error: string) => void;
  helperText?: React.ReactNode;
  MenuItemProps?: Partial<MenuItemProps>;
  onChange?: SelectProps["onChange"];
  onBlur?: SelectProps["onBlur"];
};

export function SocketSelect<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
>(props: SocketSelectProps<TEntry, TAllowedUpdate, TKey>) {
  const {
    state,
    update,
    property,
    options,
    label,
    commitMode = "change",
    debounceMs,
    format,
    parse,
    onSuccess,
    onError,
    onChange,
    onBlur,
    disabled,
    helperText,
    MenuItemProps,
    id,
    ...mui
  } = props;

  const {
    value,
    onLocalChange,
    onBlur: handleBlur,
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
  const labelId = label ? `${id ?? property.toString()}-label` : undefined;

  const handleChange = React.useCallback<NonNullable<SelectProps["onChange"]>>(
    (event) => {
      onChange?.(event, null);
      onLocalChange(event.target.value as string | number);
    },
    [onChange, onLocalChange]
  );

  const handleBlurWrapped = React.useCallback<
    NonNullable<SelectProps["onBlur"]>
  >(
    (event) => {
      onBlur?.(event);
      handleBlur();
    },
    [onBlur, handleBlur]
  );

  return (
    <FormControl
      fullWidth={mui.fullWidth}
      disabled={mergedDisabled}
      error={mui.error}
    >
      {label ? <InputLabel id={labelId}>{label}</InputLabel> : null}
      <Select
        {...mui}
        id={id}
        labelId={labelId}
        label={label}
        value={value as unknown as SelectProps["value"]}
        onChange={handleChange}
        onBlur={handleBlurWrapped}
        disabled={mergedDisabled}
      >
        {options.map((opt) => (
          <MenuItem
            key={String(opt.value)}
            value={opt.value}
            {...MenuItemProps}
          >
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
