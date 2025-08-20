"use client";

import { useMemo } from "react";
import { useSubscription } from "../useSubscription";
import { useCurrentUserSub } from "../user/useUserSub";
import type { Chat } from "@shared/types";

export type EntryAccess = "None" | "Read" | "Moderate" | "Admin";

const accessOrder: Record<EntryAccess, number> = {
  None: 0,
  Read: 1,
  Moderate: 2,
  Admin: 3,
};

function maxAccess(a: EntryAccess, b: EntryAccess): EntryAccess {
  return accessOrder[a] >= accessOrder[b] ? a : b;
}

export function useChatSub(
  chatId: string | null,
  options?: { autoSubscribe?: boolean }
) {
  const { user } = useCurrentUserSub();
  const {
    data,
    loading,
    error,
    isReady,
    subscribe,
    unsubscribe,
    isSubscribed,
  } = useSubscription("chatService", chatId, {
    autoSubscribe: options?.autoSubscribe ?? true,
  });

  const chat = (data as Chat | null) || null;

  const access: EntryAccess = useMemo(() => {
    if (!user) {
      return "None";
    }

    // Service-level access
    const svcLevel = (
      user.serviceAccess as unknown as
        | Record<string, "Read" | "Moderate" | "Admin">
        | undefined
    )?.["chatService"];
    let current: EntryAccess = svcLevel ?? "Read"; // Authenticated users default to Read for non-entry methods; per-entry still enforced below

    // Entry-level ACL
    try {
      const aclList =
        (chat?.acl as unknown as Array<{
          userId: string;
          level: EntryAccess;
        }>) || [];
      const mine = aclList.find((a) => a.userId === user.id);
      if (mine) {
        current = maxAccess(current, mine.level);
      }
    } catch {
      // ignore
    }

    return current;
  }, [chat?.acl, user]);

  return {
    chat,
    access,
    loading,
    error,
    isReady,
    subscribe,
    unsubscribe,
    isSubscribed,
    chatId,
  } as const;
}
