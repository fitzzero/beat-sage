"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useServiceMethod } from "../useServiceMethod";
import type { UpdateUserPayload, User } from "@shared/types";

type UseUserUpdateOptions = {
  onSuccess?: (user: User | undefined) => void;
  onError?: (error: string) => void;
};

/**
 * Hook for updating user data.
 * Clean implementation - requires explicit userId.
 *
 * Usage:
 * ```tsx
 * const { updateUser, loading, error } = useUserUpdate(userId);
 * await updateUser({ name: "New Name" });
 * ```
 */
export function useUserUpdate(
  userId: string | null,
  options: UseUserUpdateOptions = {}
) {
  const {
    execute: executeUpdate,
    loading,
    error,
    isReady,
  } = useServiceMethod("userService", "updateUser", options);

  // Convenient update method that automatically includes the user ID
  const updateUser = useCallback(
    async (data: UpdateUserPayload) => {
      if (!userId) {
        throw new Error("No user ID available for update");
      }

      return executeUpdate({
        id: userId,
        data,
      });
    },
    [executeUpdate, userId]
  );

  return {
    updateUser,
    loading,
    error,
    isReady,
    userId,
  };
}

/**
 * Convenience hook for updating current session user.
 * Handles session logic and passes userId to useUserUpdate.
 */
export function useCurrentUserUpdate(options: UseUserUpdateOptions = {}) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const result = useUserUpdate(userId, options);

  return {
    ...result,
    isCurrentUser: true, // This is always the current user
  };
}
