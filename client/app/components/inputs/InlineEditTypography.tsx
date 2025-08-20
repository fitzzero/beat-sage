"use client";

import * as React from "react";
import { Typography, type TypographyProps } from "@mui/material";
import { SocketTextField, type SocketTextFieldProps } from "./SocketTextField";

// Note: Update function type is inherited via SocketTextFieldProps in props

export type InlineEditTypographyProps<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
> = Omit<
  SocketTextFieldProps<TEntry, TAllowedUpdate, TKey>,
  "label" | "fullWidth" | "size" | "variant"
> &
  Omit<TypographyProps, "onChange"> & {
    canUpdate?: boolean;
    getDisplay?: (state: TEntry | null, property: TKey) => React.ReactNode;
  };

export default function InlineEditTypography<
  TEntry,
  TAllowedUpdate,
  TKey extends keyof TAllowedUpdate
>(props: InlineEditTypographyProps<TEntry, TAllowedUpdate, TKey>) {
  const { canUpdate = false, getDisplay, state, property, sx, ...rest } = props;

  const [isEditing, setIsEditing] = React.useState(false);

  const onBlur = React.useCallback(() => {
    // Delay clearing edit mode until after potential click events fire
    setTimeout(() => setIsEditing(false), 0);
  }, []);

  if (isEditing && canUpdate) {
    return (
      <SocketTextField<TEntry, TAllowedUpdate, TKey>
        {...(props as SocketTextFieldProps<TEntry, TAllowedUpdate, TKey>)}
        autoFocus
        size="small"
        variant="standard"
        fullWidth={false}
        onBlur={onBlur}
      />
    );
  }

  const display = getDisplay
    ? getDisplay(state ?? null, property)
    : ((state &&
        (state as unknown as Record<string, unknown>)[property as string]) as
        | string
        | number
        | React.ReactNode
        | undefined) ?? "";

  // Prepare safe Typography props by filtering out SocketTextField-only props
  const {
    update: _update,
    commitMode: _commitMode,
    debounceMs: _debounceMs,
    format: _format,
    parse: _parse,
    onSuccess: _onSuccess,
    onError: _onError,
    state: _state,
    property: _property,
    onChange: _onChange,
    onBlur: _onBlur,
    ...typographySafe
  } = rest as Record<string, unknown>;

  return (
    <Typography
      {...(typographySafe as TypographyProps)}
      role={canUpdate ? "button" : undefined}
      tabIndex={canUpdate ? 0 : undefined}
      sx={{
        cursor: canUpdate ? "pointer" : undefined,
        outline: "none",
        ...(sx as object),
      }}
      onClick={() => {
        if (canUpdate) {
          // Defer to avoid blur/click race when switching back to edit
          setTimeout(() => setIsEditing(true), 0);
        }
      }}
      onKeyDown={(e) => {
        if (!canUpdate) {
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setTimeout(() => setIsEditing(true), 0);
        }
      }}
    >
      {display as React.ReactNode}
    </Typography>
  );
}
