import type {
  User,
  Chat,
  UserServiceMethods,
  ChatServiceMethods,
  MessageServiceMethods,
  AgentServiceMethods,
  ModelServiceMethods,
  CharacterServiceMethods,
  GenreServiceMethods,
  SongServiceMethods,
  LocationServiceMethods,
  PartyServiceMethods,
  InstanceServiceMethods,
  PartySnapshot,
  InstanceSnapshot,
} from "@shared/types";
export type SubscriptionDataMap = {
  userService: User;
  chatService: Chat | null;
  messageService: unknown;
  agentService: import("@shared/types").Agent | null;
  memoryService: Record<string, unknown> | null;
  partyService: PartySnapshot;
  instanceService: InstanceSnapshot;
};

export type ServiceMethodsMap = {
  userService: UserServiceMethods;
  modelService: ModelServiceMethods;
  agentService: AgentServiceMethods;
  chatService: ChatServiceMethods;
  messageService: MessageServiceMethods;
  memoryService: import("@shared/types").MemoryServiceMethods;
  characterService: CharacterServiceMethods;
  genreService: GenreServiceMethods;
  songService: SongServiceMethods;
  locationService: LocationServiceMethods;
  partyService: PartyServiceMethods;
  instanceService: InstanceServiceMethods;
};
