"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useListLocations() {
  return useServiceMethod("locationService", "listLocations");
}
