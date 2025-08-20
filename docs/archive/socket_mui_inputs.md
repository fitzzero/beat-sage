## Socket-aware MUI Inputs (Spec)

Purpose: Provide thin, consistent wrappers around MUI inputs that sync a single property of a service entry via existing socket hooks, minimizing boilerplate while honoring our UI and hooks conventions.

References

- Service hooks: `useSubscription`, `useServiceMethod`, and service-specific wrappers (see `app/hooks/*`) [service-hooks]
- Client UI: prefer MUI defaults; centralize styling in `app/theme.ts` [client-ui]
- Less code > more code: reuse, keep wrappers small and composable

### Goals

- Each component extends core MUI components, props pass-through first.
- One consistent API surface for socket-syncing a single property.
- No bespoke socket logic inside components; reuse existing hooks and typed update methods.
- Minimal styling decisions; rely on MUI defaults and theme.

### High-level design

- Shared logic in a tiny helper hook `useSocketInput` that manages:
  - Local value vs remote value from `state`
  - Commit strategy: onChange (debounced), onBlur, onEnter
  - Loading/disabled/error plumbing
  - Optimistic updates + server resync
  - Optional value transforms (format/parse)
- Five wrappers render the appropriate MUI input and wire event handlers from `useSocketInput`.

### Directory structure

- `client/app/components/inputs/`
  - `useSocketInput.ts` (shared logic)
  - `SocketTextField.tsx`
  - `SocketSwitch.tsx`
  - `SocketSlider.tsx`
  - `SocketSelect.tsx`
  - `SocketCheckbox.tsx`
  - `index.ts`

Optional path alias (future): add `@inputs/* -> app/components/inputs/*` to `client/tsconfig.json` once components land.

### Common props (all Socket\* components)

- `state: TEntry | null`
  - The subscribed entry object (e.g., `User` from `useUserSub`).
- `update: (data: Partial<TAllowedUpdate>) => Promise<TEntry | undefined | null>`
  - The service update method (e.g., returned by `useUserUpdate`). It receives a shallow patch of updateable fields.
- `property: TKey` where `TKey extends keyof TAllowedUpdate`
  - The property of the entry being edited (e.g., `'name'`).
- `label?: string`
- `commitMode?: "change" | "blur" | "enter"` (default: `"blur"`)
- `debounceMs?: number` (default: `400`; only used when `commitMode="change"`)
- `disabled?: boolean` (additional to loading)
- `readOnly?: boolean`
- `helperText?: ReactNode`
- `onSuccess?: (entry: TEntry | undefined | null) => void`
- `onError?: (error: string) => void`
- `format?: (v: unknown) => unknown` (entry -> UI)
- `parse?: (v: unknown) => unknown` (UI -> entry)
- All other MUI props should pass-through to the underlying component via prop spreading while avoiding prop collisions.

Type safety

- `TEntry` is the subscribed entry type (e.g., `User`).
- `TAllowedUpdate` is the service-defined payload type for updates (e.g., `UpdateUserPayload`).
- `TKey` is constrained to keys of `TAllowedUpdate`, ensuring compile-time safety that a field is actually updatable.

### Behavior

- Local state mirrors `state[property]` when not actively editing. While editing, local changes are preserved and not clobbered by remote updates until commit or blur.
- Commit strategies:
  - `change`: debounce and send patch as the user types/toggles.
  - `blur`: update on blur.
  - `enter`: update on Enter (TextField only) and on blur.
- Loading/error handling:
  - Show `error` state and `helperText` when the latest update failed.
  - Disable input while an update is in-flight or when `disabled` is true.
  - Keep MUI defaults; no custom spinners by default.
- Optimistic update: set local value immediately; remote subscription will confirm actual value. If the server returns a different value, remote value will overwrite when not editing.

### Component-specific additions

- SocketTextField
  - Additional props: `type`, `multiline`, `minRows`, `maxRows`, `placeholder`, `fullWidth`, etc. (MUI pass-through). Prefer `minRows`/`maxRows` over `rows` per MUI v5.
  - Auto-shrink label when the field has a value to avoid overlap; set `InputLabelProps.shrink` if needed.
  - `enter` mode supported.
- SocketSwitch / SocketCheckbox
  - Boolean-only fields. `parse/format` default to boolean coercion.
- SocketSlider
  - Numeric fields. Additional props: `min`, `max`, `step`, `marks` (pass-through).
- SocketSelect
  - Discrete options. Prop: `options: Array<{ label: string; value: string | number }>`; optional `renderValue` and `native` support.

### Example usage

```tsx
import { useCurrentUserSub, useCurrentUserUpdate } from "@/app/hooks";
// Once path alias exists: import { SocketTextField } from "@inputs";
import { SocketTextField } from "@/app/components/inputs/SocketTextField";

export function ProfileNameField() {
  const { user, loading: subLoading } = useCurrentUserSub();
  const { updateUser, loading: updLoading, error } = useCurrentUserUpdate();

  return (
    <SocketTextField
      state={user}
      update={updateUser}
      property="name"
      label="Display name"
      commitMode="blur"
      disabled={subLoading}
      helperText={error || undefined}
      error={!!error}
      fullWidth
    />
  );
}
```

### `useSocketInput` responsibilities (shared helper)

- Derive `remoteValue = state?.[property]`.
- Manage `localValue`, `isEditing`, and `inFlight`.
- Expose event handlers tailored per component:
  - `onChange` + `value` for text/select/slider
  - `onBlur`/`onKeyDown` (TextField) to commit in `blur`/`enter` modes
  - `checked` + `onChange` for switch/checkbox
- Apply `format`/`parse` as needed.
- Call `update({ [property]: parsedValue })` using the service method.
- Bubble `onSuccess`/`onError` and reset `isEditing` on success.

Minimal algorithm

1. Initialize `localValue` from `remoteValue`.
2. If not editing and `remoteValue` changes, sync `localValue`.
3. On user input:
   - Update `localValue`; set `isEditing`.
   - If `commitMode="change"`, debounce call to `update`.
4. On blur/enter (as configured), call `update`.
5. While update is in-flight, disable input and ignore concurrent commits.

### Error states

- Show MUI `error` and `helperText` when update fails. Do not auto-clear `helperText`; let the next edit clear locally or remote success clear.
- Prefer non-intrusive indications; no toasts by default.

### Accessibility

- Forward `ref` to the underlying MUI component (where applicable).
- Preserve all ARIA attributes from pass-through props.

### Testing checklist

- Type-level: property key constrained to updateable fields.
- Behavior: change/blur/enter modes commit correctly; debounce respected.
- Concurrency: remote updates while editing do not clobber local until commit.
- Error handling: error appears in `helperText`; disabled state during in-flight.

### Implementation plan (incremental)

1. Implement `useSocketInput` with generics and commit modes.
2. Implement `SocketTextField` first; validate behavior and ergonomics.
3. Implement boolean variants: `SocketSwitch`, `SocketCheckbox`.
4. Implement `SocketSlider` and `SocketSelect` with value parsing.
5. Add `index.ts` barrel and (optional) `@inputs/*` alias in `client/tsconfig.json`.
6. Add story-like test page under `app/test-components/` to exercise each wrapper.

### Notes

- Keep wrappers thin; avoid styling beyond MUI props.
- Reuse service hooks only; do not import socket context directly inside components.
- Consider an optional `validate(value) => string | null` prop later; for now leave validation to parent.
