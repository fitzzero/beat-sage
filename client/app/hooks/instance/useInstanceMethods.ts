"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useCreateInstance() {
  return useServiceMethod("instanceService", "createInstance");
}

export function useStartInstance() {
  return useServiceMethod("instanceService", "startInstance");
}

// Subscribe implemented server-side via custom subscribe method name; our generic useSubscription
// uses serviceName+entryId pattern. Expose a typed helper when needed in GameContext.
