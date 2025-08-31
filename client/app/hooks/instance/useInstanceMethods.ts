"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useCreateInstance() {
  return useServiceMethod("instanceService", "createInstance");
}

export function useStartInstance() {
  return useServiceMethod("instanceService", "startInstance");
}

export function useAttemptBeat() {
  return useServiceMethod("instanceService", "attemptBeat");
}

export function useRestartInstance() {
  return useServiceMethod("instanceService", "restartInstance");
}

// Subscribe implemented server-side via custom subscribe method name; our generic useSubscription
// uses serviceName+entryId pattern. Expose a typed helper when needed in GameContext.

export function useUpdateInstanceSettings() {
  return useServiceMethod("instanceService", "updateSettings");
}
