"use client";

import { useServiceMethod } from "../useServiceMethod";

export function usePostMessage() {
  return useServiceMethod("messageService", "postMessage");
}

export function useListMessages() {
  return useServiceMethod("messageService", "listMessages");
}

export function useSubscribeChatMessages() {
  return useServiceMethod("messageService", "subscribeChatMessages");
}

export function useStreamAssistantMessage() {
  return useServiceMethod("messageService", "streamAssistantMessage");
}

export function useCancelStream() {
  // Use the generic hook to emit cancel; types may not include admin-only methods.
  return useServiceMethod("messageService" as never, "cancelStream" as never);
}


