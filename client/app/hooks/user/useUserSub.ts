"use client";

import { useSession } from "next-auth/react";
import { useSubscription } from "../useSubscription";
import type { User } from "@shared/types";

type UseUserSubOptions = {
  onUpdate?: (user: User) => void;
  onError?: (error: string) => void;
  autoSubscribe?: boolean;
};

/**
 * Subscribe to user data for real-time updates.
 * Clean implementation - requires explicit userId.
 *
 * Usage:
 * ```tsx
 * const { user, loading, error } = useUserSub(userId);
 * ```
 */
export function useUserSub(
  userId: string | null,
  options: UseUserSubOptions = {}
) {
  const {
    data: user,
    loading,
    error,
    isReady,
    subscribe,
    unsubscribe,
    isSubscribed,
  } = useSubscription("userService", userId, options);

  return {
    user,
    loading,
    error,
    isReady,
    subscribe,
    unsubscribe,
    isSubscribed,
    userId,
  };
}

/**
 * Convenience hook for current session user subscription.
 * Handles session logic and passes userId to useUserSub.
 */
export function useCurrentUserSub(options: UseUserSubOptions = {}) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const result = useUserSub(userId, options);

  return {
    ...result,
    isCurrentUser: true, // This is always the current user
  };
}
