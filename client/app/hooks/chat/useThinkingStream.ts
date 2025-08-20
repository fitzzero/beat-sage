"use client";

import { useEffect, useState } from "react";
import { useSocket } from "../../hooks";

export type StepEvent = {
  index: number;
  total: number;
  title: string;
  status: "start" | "end";
};

export function useThinkingStream(chatId?: string | null) {
  const { socket, isConnected } = useSocket();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [stepEvents, setStepEvents] = useState<StepEvent[]>([]);
  const [deltaText, setDeltaText] = useState("");
  const [contextMessages, setContextMessages] = useState<number | undefined>(
    undefined
  );
  const [hadActivity, setHadActivity] = useState(false);

  useEffect(() => {
    if (!chatId || !socket || !isConnected) {
      return;
    }
    const eventName = `messageService:update:${chatId}`;
    const onUpdate = (evt: unknown) => {
      type EventUnion =
        | { type: "delta"; content: string }
        | { type: "final"; message: { id: string } }
        | { type: "created"; id: string }
        | {
            type: "status";
            phase: "plan_start" | "plan_end" | "run_start" | "run_end";
            steps?: string[];
          }
        | {
            type: "step";
            index: number;
            total: number;
            title: string;
            status: "start" | "end";
          }
        | { type: "context"; messages: number }
        | {
            type: "tool";
            phase: "start" | "result" | "error";
            toolName: string;
            payload?: unknown;
            result?: unknown;
            error?: string;
          };
      const event = evt as EventUnion;
      if (!event) {
        return;
      }
      if (event.type === "status") {
        if (event.phase === "run_start") {
          setOpen(true);
          setSteps(event.steps || []);
          setStepEvents([]);
          setDeltaText("");
          setContextMessages(undefined);
          setHadActivity(false);
        }
        if (event.phase === "plan_end" && event.steps) {
          setSteps(event.steps);
        }
        if (event.phase === "run_end") {
          // Keep panel open until final/created arrives
        }
      } else if (event.type === "context") {
        setContextMessages(event.messages);
        setHadActivity(true);
      } else if (event.type === "step") {
        setStepEvents((prev) => [...prev, event]);
        setHadActivity(true);
      } else if (event.type === "delta") {
        setDeltaText((prev) => prev + event.content);
        setHadActivity(true);
      } else if (event.type === "tool") {
        // Keep panel open and mark activity; UI layer can render tool events as separate chips in the future
        setHadActivity(true);
        setOpen(true);
      } else if (event.type === "final" || event.type === "created") {
        // Collapse but keep state for post-final inspection; new run will reset
        setOpen(false);
      }
    };
    socket.on(eventName, onUpdate);
    return () => {
      socket.off(eventName, onUpdate);
    };
  }, [chatId, socket, isConnected]);

  return {
    open,
    setOpen,
    steps,
    stepEvents,
    deltaText,
    contextMessages,
    hadActivity,
  };
}
