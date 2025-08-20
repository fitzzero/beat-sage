"use client";

import { useServiceMethod } from "../useServiceMethod";

export function useCreateChat() {
  return useServiceMethod("chatService", "createChat");
}

export function useInviteUser() {
  return useServiceMethod("chatService", "inviteUser");
}

export function useRemoveUser() {
  return useServiceMethod("chatService", "removeUser");
}

export function useLeaveChat() {
  return useServiceMethod("chatService", "leaveChat");
}

export function useAttachAgent() {
  return useServiceMethod("chatService", "attachAgent");
}

export function useListMyChats() {
  return useServiceMethod("chatService", "listMyChats");
}

export function useSubscribeWithMessages() {
  return useServiceMethod("chatService", "subscribeWithMessages");
}

export function useUpdateChatTitle() {
  return useServiceMethod("chatService", "updateTitle");
}

export function useAdminDeleteChat() {
  return useServiceMethod("chatService", "adminDelete");
}

// Agent/model listing hooks
export function useListAgents() {
  return useServiceMethod("agentService", "listAll");
}
export function useCreateAgent() {
  return useServiceMethod("agentService", "createAgent");
}
export function useListModels() {
  return useServiceMethod("modelService", "listAll");
}
