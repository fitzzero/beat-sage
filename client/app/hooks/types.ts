import type {
  User,
  Chat,
  UserServiceMethods,
  ChatServiceMethods,
  MessageServiceMethods,
  AgentServiceMethods,
  ModelServiceMethods,
} from "@shared/types";
export type SubscriptionDataMap = {
  userService: User;
  chatService: Chat | null;
  messageService: unknown;
  agentService: import("@shared/types").Agent | null;
  memoryService: Record<string, unknown> | null;
};

export type ServiceMethodsMap = {
  userService: UserServiceMethods;
  modelService: ModelServiceMethods;
  agentService: AgentServiceMethods;
  chatService: ChatServiceMethods;
  messageService: MessageServiceMethods;
  memoryService: import("@shared/types").MemoryServiceMethods;
};
