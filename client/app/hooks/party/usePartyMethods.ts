"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useCreateParty() {
  return useServiceMethod("partyService", "createParty");
}

export function useJoinParty() {
  return useServiceMethod("partyService", "joinParty");
}

export function useLeaveParty() {
  return useServiceMethod("partyService", "leaveParty");
}

export function useSetReady() {
  return useServiceMethod("partyService", "setReady");
}

export function useSubscribePartyWithMembers() {
  return useServiceMethod("partyService", "subscribeWithMembers");
}
