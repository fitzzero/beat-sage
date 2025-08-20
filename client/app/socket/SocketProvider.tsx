"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
// TODO: Add proper Socket.io typing when dynamic event names are resolved

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  connect: () => void;
  disconnect: () => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectionError: null,
  connect: () => {},
  disconnect: () => {},
});

type SocketProviderProps = {
  children: React.ReactNode;
};

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Use refs to track state without causing re-renders
  const socketRef = useRef<Socket | null>(null);
  const connectionAttemptRef = useRef<boolean>(false);
  const { data: session } = useSession();

  // No direct cookie access needed; token is fetched from API route

  // Cleanup existing socket
  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }
    setSocket(null);
    setIsConnected(false);
    setConnectionError(null);
    connectionAttemptRef.current = false;
  }, []);

  // Create socket connection
  const createSocket = useCallback(async () => {
    // Prevent multiple simultaneous connection attempts
    if (connectionAttemptRef.current || !session?.user) {
      return;
    }

    connectionAttemptRef.current = true;
    setConnectionError(null);

    try {
      const serverPort = process.env.SERVER_PORT || "4000";
      const serverUrl = `http://localhost:${serverPort}`;
      const tokenRes = await fetch("/api/socket-token", {
        credentials: "include",
      });
      const tokenJson = await tokenRes.json();
      const socketToken = tokenJson?.token as string | undefined;
      const newSocket = io(serverUrl, {
        withCredentials: true,
        auth: {
          userId: session.user.id,
          socketToken,
        },
        // Connection options for reliability
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      // Set up event listeners
      newSocket.on("connect", () => {
        setIsConnected(true);
        setConnectionError(null);
        connectionAttemptRef.current = false;
      });

      newSocket.on("disconnect", (reason) => {
        setIsConnected(false);
        connectionAttemptRef.current = false;

        // Socket disconnected - could log to service in production
        if (reason !== "io client disconnect") {
          // Unexpected disconnect reason
        }
      });

      newSocket.on("connect_error", (error) => {
        setConnectionError(error.message);
        setIsConnected(false);
        connectionAttemptRef.current = false;
      });

      // Store socket in ref and state
      socketRef.current = newSocket;
      setSocket(newSocket);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Connection failed"
      );
      connectionAttemptRef.current = false;
    }
  }, [session?.user]);

  // Manual connect function
  const connect = useCallback(() => {
    if (!session?.user) {
      return;
    }
    cleanupSocket();
    createSocket();
  }, [session?.user, cleanupSocket, createSocket]);

  // Manual disconnect function
  const disconnect = useCallback(() => {
    cleanupSocket();
  }, [cleanupSocket]);

  // Handle session changes
  useEffect(() => {
    if (session?.user) {
      // User is authenticated, ensure we have a connection
      if (!socketRef.current && !connectionAttemptRef.current) {
        createSocket();
      }
    } else {
      // User is not authenticated, cleanup any existing connection
      cleanupSocket();
    }

    // Cleanup on unmount
    return () => {
      cleanupSocket();
    };
  }, [session?.user, createSocket, cleanupSocket]);

  const contextValue: SocketContextType = {
    socket,
    isConnected,
    connectionError,
    connect,
    disconnect,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
