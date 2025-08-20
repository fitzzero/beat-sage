import type { CustomSocket } from "../../../core/baseService";
import type UserService from "..";
import type { UpdateUserPayload, User } from "@shared/types";

export async function updateUserHandler(
  service: UserService,
  payload: { id: string; data: UpdateUserPayload },
  socket: CustomSocket
): Promise<User | undefined> {
  const { id, data } = payload;

  if (!socket.userId) {
    throw new Error("Authentication required");
  }

  // Access enforcement is handled centrally via BaseService.ensureAccessForMethod

  const allowed = new Set(["username", "name", "image"]);
  const invalid = Object.keys(data).filter((k) => !allowed.has(k));
  if (invalid.length > 0) {
    throw new Error("Invalid update fields");
  }

  const updatedUser = await service["update"](id, {
    ...data,
  } as never);

  if (updatedUser) {
    service["logger"].info(`User ${socket.userId} updated user ${id}`, {
      updatedFields: Object.keys(data),
    });
  }

  return updatedUser;
}
