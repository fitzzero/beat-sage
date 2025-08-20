"use client";

import { useSubscription } from "../useSubscription";

export function useMemorySub(id: string | null) {
  return useSubscription("memoryService", id);
}
