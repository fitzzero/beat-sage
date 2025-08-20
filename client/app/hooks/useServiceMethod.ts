"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useSocket } from "../socket/SocketProvider";
import type { ServiceResponse } from "@shared/types";
import type { ServiceMethodsMap } from "./types";
// TODO: Add proper Socket.io typing when dynamic event names are resolved

// Use centralized map for all service methods

type UseServiceMethodOptions<TResponse> = {
  onSuccess?: (data: TResponse) => void;
  onError?: (error: string) => void;
  // Future feature flags
  optimisticUpdate?: boolean;
  retryAttempts?: number;
  timeout?: number;
};

type MethodDefinition = {
  payload: unknown;
  response: unknown;
};

export function useServiceMethod<
  TService extends keyof ServiceMethodsMap,
  TMethod extends keyof ServiceMethodsMap[TService]
>(
  serviceName: TService,
  methodName: TMethod,
  options?: UseServiceMethodOptions<
    ServiceMethodsMap[TService][TMethod] extends MethodDefinition
      ? ServiceMethodsMap[TService][TMethod]["response"]
      : unknown
  >
) {
  const { socket, isConnected } = useSocket();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<
    ServiceMethodsMap[TService][TMethod] extends MethodDefinition
      ? ServiceMethodsMap[TService][TMethod]["response"] | null
      : unknown
  >(null);

  // Stabilize callback refs and extract options
  const optionsRef = useRef(options);
  const {
    timeout = 10000,
    // Future features available in options type but not extracted yet:
    // retryAttempts, optimisticUpdate
  } = options || {};

  useEffect(() => {
    optionsRef.current = options;
  });

  type PayloadType =
    ServiceMethodsMap[TService][TMethod] extends MethodDefinition
      ? ServiceMethodsMap[TService][TMethod]["payload"]
      : unknown;
  type ResponseType =
    ServiceMethodsMap[TService][TMethod] extends MethodDefinition
      ? ServiceMethodsMap[TService][TMethod]["response"]
      : unknown;

  const execute = useCallback(
    async (payload: PayloadType): Promise<ResponseType | null> => {
      if (!socket || !isConnected) {
        const errorMsg = "Socket not connected";
        setError(errorMsg);
        optionsRef.current?.onError?.(errorMsg);
        return null;
      }

      setLoading(true);
      setError(null);

      return new Promise<ResponseType | null>((resolve) => {
        const eventName = `${serviceName}:${String(methodName)}`;
        const timeoutId = setTimeout(() => {
          const errorMsg = "Request timeout";
          setError(errorMsg);
          setLoading(false);
          optionsRef.current?.onError?.(errorMsg);
          resolve(null);
        }, timeout);

        socket.emit(
          eventName,
          payload,
          (response: ServiceResponse<ResponseType>) => {
            clearTimeout(timeoutId);
            setLoading(false);

            if (response.success) {
              setError(null);
              setData(response.data);
              optionsRef.current?.onSuccess?.(response.data);
              resolve(response.data);
            } else {
              setError(response.error);
              optionsRef.current?.onError?.(response.error);
              resolve(null);
            }
          }
        );
      });
    },
    [socket, isConnected, serviceName, methodName, timeout]
  );

  return {
    execute,
    loading,
    error,
    data,
    isReady: socket && isConnected,
  };
}
