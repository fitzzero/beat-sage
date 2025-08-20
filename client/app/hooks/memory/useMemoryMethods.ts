"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useCreateMemory() {
  return useServiceMethod("memoryService", "createMemory");
}

export function useFindMemories() {
  return useServiceMethod("memoryService", "findMemories");
}

export function useGetMemory() {
  return useServiceMethod("memoryService", "getMemory");
}

export function useUpdateMemory() {
  return useServiceMethod("memoryService", "updateMemory");
}

export function useLinkMemories() {
  return useServiceMethod("memoryService", "linkMemories");
}

export function useUnlinkMemories() {
  return useServiceMethod("memoryService", "unlinkMemories");
}

export function useSummarizeChatIfNeeded() {
  return useServiceMethod("memoryService", "summarizeChatIfNeeded");
}
