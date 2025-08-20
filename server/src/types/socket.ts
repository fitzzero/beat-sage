import type { ServiceResponse } from "@shared/types";
export type { ServiceResponse } from "@shared/types";
import type { CustomSocket } from "../core/baseService";

export type ServiceMethodHandler<P = unknown, R = unknown> = (
  payload: P,
  socket: CustomSocket
) => Promise<R>;

export type ServiceMethodDefinition<P = unknown, R = unknown> = {
  name: string;
  access: string;
  handler: ServiceMethodHandler<P, R>;
  resolveEntryId?: (payload: P) => string | null;
};

// Callback types for Socket.io events
export type SocketCallback<T = unknown> = (
  response: ServiceResponse<T>
) => void;

// Evergreen comment: Type definitions for Socket.io service integration and standardized responses.
