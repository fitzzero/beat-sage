// Core hooks - foundation for all client-server sync
export { useSubscription } from "./useSubscription";
export { useServiceMethod } from "./useServiceMethod";

// Service-specific hooks - clean individual patterns
export { useUserSub, useCurrentUserSub } from "./user/useUserSub";
export { useUserUpdate, useCurrentUserUpdate } from "./user/useUserUpdate";

// Chat hooks
export {
  useCreateChat,
  useInviteUser,
  useRemoveUser,
  useLeaveChat,
  useAttachAgent,
  useListMyChats,
  useSubscribeWithMessages,
  useUpdateChatTitle,
  useAdminDeleteChat,
  useListModels,
} from "./chat/useChatMethods";

// Message hooks
export {
  usePostMessage,
  useListMessages,
  useSubscribeChatMessages,
  useStreamAssistantMessage,
  useCancelStream,
} from "./message/useMessageMethods";

// Chat subscription convenience
export { useChatSub } from "./chat/useChatSub";

// Memory hooks
export {
  useCreateMemory,
  useFindMemories,
  useGetMemory,
  useUpdateMemory,
  useLinkMemories,
  useUnlinkMemories,
  useSummarizeChatIfNeeded,
} from "./memory/useMemoryMethods";
export { useMemorySub } from "./memory/useMemorySub";

// Agent hooks
export {
  useCreateAgent,
  useUpdateAgent,
  useListAgents,
} from "./agent/useAgentMethods";

// Socket provider for context
export { useSocket } from "../socket/SocketProvider";

// Re-export types for convenience
export type { User, UpdateUserPayload, ServiceResponse } from "@shared/types";

// Character hooks
export {
  useCreateCharacter,
  useUpdateCharacter,
  useListMyCharacters,
} from "./character/useCharacterMethods";

// Party hooks
export {
  useCreateParty,
  useJoinParty,
  useLeaveParty,
  useSetReady,
  useSubscribePartyWithMembers,
} from "./party/usePartyMethods";

// Instance hooks
export {
  useCreateInstance,
  useStartInstance,
  useUpdateInstanceSettings,
} from "./instance/useInstanceMethods";

// Song hooks
export { useListSongs, useGetSongBeats } from "./song/useSongMethods";

// Location hooks
export { useListLocations } from "./location/useLocationMethods";
