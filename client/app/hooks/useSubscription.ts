"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSocket } from "../socket/SocketProvider";
import type { SubscriptionDataMap } from "./types";
// TODO: Implement proper Socket.io v4 typing - complex with dynamic event names

// Global subscription manager for deduplication
type ComponentSubscriber<T> = {
  setData: (data: T | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onUpdate?: (data: T) => void;
  onError?: (error: string) => void;
};

type SharedSubscription<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  subscribers: Set<ComponentSubscriber<T>>;
  isSubscribed: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket: any; // TODO: Type properly when Socket.io dynamic events are resolved
  subscriptionKey: string;
  cleanup?: () => void;
};

// Global map to store shared subscriptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalSubscriptions = new Map<string, SharedSubscription<any>>();

// Centralized type map import

type UseSubscriptionOptions<T> = {
  onUpdate?: (data: T) => void;
  onError?: (error: string) => void;
  autoSubscribe?: boolean; // Default true
  // Future feature flags
  enableOfflineMode?: boolean;
  cacheTTL?: number;
  refetchOnReconnect?: boolean;
};

// Helper function to broadcast updates to all subscribers
function broadcastToSubscribers<T>(sharedSub: SharedSubscription<T>) {
  sharedSub.subscribers.forEach((subscriber) => {
    subscriber.setData(sharedSub.data);
    subscriber.setLoading(sharedSub.loading);
    subscriber.setError(sharedSub.error);

    if (sharedSub.data && subscriber.onUpdate) {
      subscriber.onUpdate(sharedSub.data);
    }

    if (sharedSub.error && subscriber.onError) {
      subscriber.onError(sharedSub.error);
    }
  });
}

export function useSubscription<TService extends keyof SubscriptionDataMap>(
  serviceName: TService,
  entryId: string | null,
  options: UseSubscriptionOptions<SubscriptionDataMap[TService]> = {}
) {
  const { socket, isConnected } = useSocket();
  const [data, setData] = useState<SubscriptionDataMap[TService] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    autoSubscribe = true,
    onUpdate,
    onError,
    // Future features available in options type but not extracted yet:
    // enableOfflineMode, cacheTTL, refetchOnReconnect
  } = options;

  // Create subscription key for deduplication
  const subscriptionKey = entryId ? `${serviceName}:${entryId}` : null;

  // Create stable component subscriber
  const componentSubscriber = useRef<
    ComponentSubscriber<SubscriptionDataMap[TService]>
  >({
    setData,
    setLoading,
    setError,
    onUpdate,
    onError,
  });

  // Update callbacks on each render
  useEffect(() => {
    componentSubscriber.current.onUpdate = onUpdate;
    componentSubscriber.current.onError = onError;
  });

  // Main subscription management effect
  useEffect(() => {
    if (!socket || !isConnected || !subscriptionKey || !autoSubscribe) {
      return;
    }

    // Capture current subscriber to avoid stale closure
    const currentSubscriber = componentSubscriber.current;

    // Get or create shared subscription
    let sharedSub = globalSubscriptions.get(
      subscriptionKey
    ) as SharedSubscription<SubscriptionDataMap[TService]>;

    if (!sharedSub) {
      // Create new shared subscription
      sharedSub = {
        data: null,
        loading: false,
        error: null,
        subscribers: new Set(),
        isSubscribed: false,
        socket,
        subscriptionKey,
      };
      globalSubscriptions.set(subscriptionKey, sharedSub);
    }

    // Add this component to subscribers
    sharedSub.subscribers.add(currentSubscriber);

    // Sync component state with shared state
    setData(sharedSub.data);
    setLoading(sharedSub.loading);
    setError(sharedSub.error);

    // Initialize socket subscription if not already done
    if (!sharedSub.isSubscribed) {
      const subscribeEventName = `${serviceName}:subscribe`;
      const updateEventName = `${serviceName}:update:${entryId}`;

      // Update shared state to loading
      sharedSub.loading = true;
      sharedSub.error = null;
      broadcastToSubscribers(sharedSub);

      // Subscribe to the entity
      socket.emit(
        subscribeEventName,
        { entryId },
        (response: {
          success?: boolean;
          data?: SubscriptionDataMap[TService];
          error?: string;
        }) => {
          sharedSub.loading = false;

          if (response?.success) {
            sharedSub.isSubscribed = true;
            if (response.data) {
              sharedSub.data = response.data;
            }
          } else {
            const errorMsg = response?.error || "Subscription failed";
            sharedSub.error = errorMsg;
          }

          broadcastToSubscribers(sharedSub);
        }
      );

      // Listen for real-time updates
      const handleUpdate = (updateData: SubscriptionDataMap[TService]) => {
        // Merge partial updates to preserve fields like ACL
        const ud = updateData as unknown as Record<string, unknown> | null;
        const current = sharedSub.data as unknown as Record<
          string,
          unknown
        > | null;
        if (
          ud &&
          typeof ud === "object" &&
          (ud as { deleted?: unknown }).deleted === true
        ) {
          // Entry deleted
          sharedSub.data = null as SubscriptionDataMap[TService];
        } else if (
          ud &&
          typeof ud === "object" &&
          current &&
          typeof current === "object"
        ) {
          sharedSub.data = {
            ...(current as Record<string, unknown>),
            ...(ud as Record<string, unknown>),
          } as SubscriptionDataMap[TService];
        } else {
          sharedSub.data = updateData;
        }
        broadcastToSubscribers(sharedSub);
      };

      socket.on(updateEventName, handleUpdate);

      // Store cleanup function
      sharedSub.cleanup = () => {
        const unsubscribeEventName = `${serviceName}:unsubscribe`;
        socket.emit(unsubscribeEventName, { entryId });
        socket.off(updateEventName, handleUpdate);
      };
    }

    // Cleanup function for this component
    return () => {
      if (!sharedSub) {
        return;
      }

      // Remove this component from subscribers
      sharedSub.subscribers.delete(currentSubscriber);

      // If no more subscribers, cleanup the shared subscription
      if (sharedSub.subscribers.size === 0) {
        sharedSub.cleanup?.();
        globalSubscriptions.delete(subscriptionKey);
      }
    };
  }, [
    socket,
    isConnected,
    serviceName,
    entryId,
    subscriptionKey,
    autoSubscribe,
  ]);

  // Manual subscribe/unsubscribe functions
  const subscribe = useCallback(() => {
    if (!socket || !isConnected || !entryId) {
      return;
    }

    const subscribeEventName = `${serviceName}:subscribe`;
    socket.emit(subscribeEventName, { entryId });
  }, [socket, isConnected, serviceName, entryId]);

  const unsubscribe = useCallback(() => {
    if (!socket || !entryId) {
      return;
    }

    const unsubscribeEventName = `${serviceName}:unsubscribe`;
    socket.emit(unsubscribeEventName, { entryId });
  }, [socket, serviceName, entryId]);

  return {
    data,
    loading,
    error,
    isSubscribed: !!(
      subscriptionKey && globalSubscriptions.get(subscriptionKey)?.isSubscribed
    ),
    subscribe,
    unsubscribe,
    isReady: socket && isConnected,
  };
}
