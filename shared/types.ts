// Single source of truth: Import and re-export Prisma generated types so both client and server
// can import the same shapes without duplicating definitions.
import type {
  User,
  Account,
  Session,
  Model,
  Agent,
  Chat,
  Message,
  Memory,
  Character,
  Mana,
  Skill,
  Genre,
  Song,
  SongBeat,
  Location,
  Mob,
  Party,
  PartyMember,
  Instance,
  InstanceMob,
} from "@prisma/client";
export type {
  User,
  Account,
  Session,
  Model,
  Agent,
  Chat,
  Message,
  Memory,
  Character,
  Mana,
  Skill,
  Genre,
  Song,
  SongBeat,
  Location,
  Mob,
  Party,
  PartyMember,
  Instance,
  InstanceMob,
};

// Generic service response envelope used by socket method acks
export type ServiceResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: number };

// Admin method shared types (generic shapes; service-specific T inferred on client)
export type AdminListPayload = {
  page?: number;
  pageSize?: number;
  sort?: {
    field?: "createdAt" | "updatedAt" | "id";
    direction?: "asc" | "desc";
  };
  filter?: {
    id?: string;
    ids?: string[];
    createdAfter?: string;
    createdBefore?: string;
    updatedAfter?: string;
    updatedBefore?: string;
  } & Record<string, unknown>;
};

export type AdminListResponse<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminGetPayload = { id: string };
export type AdminCreatePayload<TInsert> = { data: Partial<TInsert> };
export type AdminUpdatePayload<TInsert> = {
  id: string;
  data: Partial<TInsert>;
};
export type AdminDeletePayload = { id: string };
export type AdminDeleteResponse = { id: string; deleted: true };
export type AdminSetEntryACLPayload = {
  id: string;
  acl: Array<{ userId: string; level: "Read" | "Moderate" | "Admin" }>;
};
export type AdminGetSubscribersPayload = { id: string };
export type AdminGetSubscribersResponse = {
  id: string;
  subscribers: Array<{ socketId: string; userId?: string }>;
};
export type AdminReemitPayload = { id: string };
export type AdminReemitResponse = { emitted: boolean };
export type AdminUnsubscribeAllPayload = { id: string };
export type AdminUnsubscribeAllResponse = { id: string; unsubscribed: number };

// Service method payload types
export type UpdateUserPayload = Partial<{
  username?: string | null;
  name?: string | null;
  image?: string | null;
}>;

// Service method parameter types for client
export type UserServiceMethods = {
  updateUser: {
    payload: { id: string; data: UpdateUserPayload };
    response: User | undefined;
  };
};

// Chat + Messages typed client method shapes
export type ChatListItem = { id: string; title: string };
export type ChatThreadMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
};

export type ChatServiceMethods = {
  createChat: {
    payload: {
      title: string;
      agentId?: string;
      members?: Array<{ userId: string; level: "Read" | "Moderate" | "Admin" }>;
    };
    response: { id: string };
  };
  inviteUser: {
    payload: {
      id: string;
      userId: string;
      level: "Read" | "Moderate" | "Admin";
    };
    response: { id: string };
  };
  removeUser: {
    payload: { id: string; userId: string };
    response: { id: string };
  };
  leaveChat: { payload: { id: string }; response: { id: string } };
  attachAgent: {
    payload: { id: string; agentId: string | null };
    response: { id: string; agentId: string | null };
  };
  listMyChats: {
    payload: { page?: number; pageSize?: number };
    response: ChatListItem[];
  };
  subscribeWithMessages: {
    payload: { id: string; limit?: number };
    response: { chat: ChatListItem | null; messages: ChatThreadMessage[] };
  };
  updateTitle: {
    payload: { id: string; title: string };
    response: { id: string; title: string } | undefined;
  };
  adminDelete: {
    payload: { id: string };
    response: { id: string; deleted: true };
  };
};

export type MessageServiceMethods = {
  postMessage: {
    payload: {
      chatId: string;
      content: string;
      role?: "user" | "assistant" | "system" | "tool";
    };
    response: { id: string };
  };
  cancelStream: {
    payload: { chatId: string };
    response: { cancelled: boolean };
  };
  listMessages: {
    payload: { chatId: string; before?: string; limit?: number };
    response: ChatThreadMessage[];
  };
  subscribeChatMessages: {
    payload: { chatId: string; limit?: number };
    response: ChatThreadMessage[];
  };
  streamAssistantMessage: {
    payload: {
      chatId: string;
      agentId?: string;
      modelId?: string;
      prompt?: string;
    };
    response: { id: string };
  };
};

export type AgentServiceMethods = {
  createAgent: {
    payload: {
      name: string;
      description?: string;
      instructions?: string;
      defaultModelId?: string;
    };
    response: { id: string };
  };
  updateAgent: {
    payload: {
      id: string;
      data: Partial<{
        name: string;
        description?: string;
        instructions?: string;
        defaultModelId?: string;
      }>;
    };
    response: { id: string } | undefined;
  };
  deleteAgent: {
    payload: { id: string };
    response: { id: string; deleted: true };
  };
  listAll: {
    payload: { page?: number; pageSize?: number };
    response: Array<{ id: string; name: string }>;
  };
  listMine: {
    payload: { page?: number; pageSize?: number };
    response: Array<{ id: string; name: string }>;
  };
};

export type MemoryServiceMethods = {
  createMemory: {
    payload: {
      title?: string;
      content: string;
      type?: string;
      tags?: string[];
      associatedIds?: string[];
      chatId?: string;
      agentId?: string;
    };
    response: { memory: MemoryDTO };
  };
  findMemories: {
    payload: {
      query: string;
      filters?: {
        chatId?: string;
        agentId?: string;
        userId?: string;
        type?: string;
        tags?: string[];
      };
      includeAssociationsDepth?: number;
      limit?: number;
      offset?: number;
    };
    response: { results: MemoryDTO[] };
  };
  getMemory: {
    payload: { id: string; includeAssociationsDepth?: number };
    response: { memory?: MemoryDTO };
  };
  updateMemory: {
    payload: {
      id: string;
      patch: Partial<{
        title: string;
        content: string;
        type: string;
        tags: string[];
        associatedIds: string[];
        pinned: boolean;
        importance: number;
        acl: Array<{ userId: string; level: "Read" | "Moderate" | "Admin" }>;
      }>;
    };
    response: { memory?: MemoryDTO };
  };
  linkMemories: {
    payload: { id: string; associate: string[]; bidirectional?: boolean };
    response: { id: string; associatedIds: string[] };
  };
  unlinkMemories: {
    payload: { id: string; remove: string[]; bidirectional?: boolean };
    response: { id: string; associatedIds: string[] };
  };
  summarizeChatIfNeeded: {
    payload: { chatId: string };
    response: { created: boolean; memory?: MemoryDTO };
  };
};

export type ModelServiceMethods = {
  listActive: {
    payload: { provider?: string };
    response: Array<{
      id: string;
      provider: string;
      modelKey: string;
      displayName: string;
    }>;
  };
  listAll: {
    payload: { provider?: string; page?: number; pageSize?: number };
    response: Array<{
      id: string;
      provider: string;
      modelKey: string;
      displayName: string;
    }>;
  };
  recordUsage: {
    payload: { id: string; inputTokens?: number; outputTokens?: number };
    response: {
      id: string;
      totalRequests: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    };
  };
};

export type MessageUpdateEvent =
  | { type: "delta"; content: string }
  | { type: "final"; message: ChatThreadMessage }
  | { type: "created"; id: string };

// Evergreen comment: Shared types for full-stack type safety sourced from Prisma.

// DTOs intentionally omitted for Project/Task – we return Prisma types directly

// Project + Task client method types
export type ProjectServiceMethods = never;

export type TaskServiceMethods = never;

// Memory DTO preserves Memory fields but strips ACL and normalizes dates to strings as returned by the service.
// Also includes optional recursive related graph emitted by the service.
export type MemoryDTO = Omit<
  Memory,
  "acl" | "createdAt" | "updatedAt" | "lastAccessedAt"
> & {
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string | null;
  related?: MemoryDTO[];
};

// ---- Beat Sage Services ----

export type CharacterServiceMethods = {
  createCharacter: {
    payload: { name: string };
    response: { id: string };
  };
  updateCharacter: {
    payload: { id: string; patch: { name?: string; online?: boolean } };
    response: Character | undefined;
  };
  listMine: {
    payload: { page?: number; pageSize?: number };
    response: Character[];
  };
};

export type SkillServiceMethods = {
  listMySkills: {
    payload: { characterId: string };
    response: Skill[];
  };
  updateSkill: {
    payload: {
      id: string;
      patch: {
        priority?: number | null;
        name?: string;
        manaCost?: number;
        damage?: number;
        cooldownMs?: number;
      };
    };
    response: Skill | undefined;
  };
};

export type GenreServiceMethods = {
  listAll: {
    payload: Record<string, never>;
    response: Array<Pick<Genre, "id" | "name" | "description">>;
  };
};

export type SongServiceMethods = {
  listSongs: {
    payload: { genreId?: string; page?: number; pageSize?: number };
    response: Array<Pick<Song, "id" | "name" | "genreId">>;
  };
  getSongBeats: {
    payload: { songId: string };
    response: Array<
      Pick<SongBeat, "index" | "timeMs" | "direction" | "holdMs">
    >;
  };
};

export type LocationServiceMethods = {
  listLocations: {
    payload: { page?: number; pageSize?: number };
    response: Array<Pick<Location, "id" | "name" | "difficulty">>;
  };
};

export type PartySnapshot = {
  hostCharacterId: string;
  members: Array<{ characterId: string; isReady: boolean }>;
};

export type PartyServiceMethods = {
  createParty: {
    payload: { hostCharacterId: string };
    response: { id: string };
  };
  joinParty: {
    payload: { partyId: string; characterId: string };
    response: { id: string };
  };
  leaveParty: {
    payload: { partyId: string; characterId: string };
    response: { id: string };
  };
  setReady: {
    payload: { partyId: string; characterId: string; isReady: boolean };
    response: { partyId: string; characterId: string; isReady: boolean };
  };
  subscribeWithMembers: {
    payload: { partyId: string };
    response: PartySnapshot;
  };
};

export type InstanceSnapshot = {
  status: Instance["status"];
  startedAt?: Date | null;
  songId: string;
  locationId: string;
  mobs: InstanceMob[];
  party: { memberIds: string[] };
};

export type InstanceServiceMethods = {
  createInstance: {
    payload: { partyId: string; locationId: string; songId: string };
    response: { id: string; status: Instance["status"] };
  };
};
