"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useCreateAgent() {
  return useServiceMethod("agentService", "createAgent");
}

export function useUpdateAgent() {
  return useServiceMethod("agentService", "updateAgent");
}

export function useListAgents() {
  return useServiceMethod("agentService", "listAll");
}
