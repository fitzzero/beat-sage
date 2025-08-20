"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, Typography } from "@mui/material";
import {
  useListMessages,
  useSubscribeChatMessages,
  useSocket,
} from "../../hooks";
import ChatMessageItem from "./ChatMessageItem";
import ThinkingPanel from "./ThinkingPanel";

type ChatHistoryProps = {
  chatId?: string | null;
};

export default function ChatHistory({ chatId }: ChatHistoryProps) {
  const listMessages = useListMessages();
  const subscribeMessages = useSubscribeChatMessages();
  const { socket, isConnected } = useSocket();
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [thinkingStepEvents, setThinkingStepEvents] = useState<
    Array<{
      index: number;
      total: number;
      title: string;
      status: "start" | "end";
    }>
  >([]);
  const [deltaText, setDeltaText] = useState("");
  const [contextSize, setContextSize] = useState<number | undefined>(undefined);
  const runIdRef = useRef<number>(0);

  useEffect(() => {
    if (!chatId) {
      return;
    }
    // Initial fetch
    void listMessages.execute({ chatId, limit: 50 });
    // Register to message service updates for this chat
    void subscribeMessages.execute({ chatId, limit: 50 });

    if (!socket || !isConnected) {
      return;
    }

    const eventName = `messageService:update:${chatId}`;
    const onUpdate = (evt: unknown) => {
      const event = evt as
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
        | { type: "context"; messages: number };

      if (!event) {
        return;
      }

      if (event.type === "status") {
        if (event.phase === "run_start") {
          runIdRef.current += 1;
          setDeltaText("");
          setThinkingStepEvents([]);
          setThinkingSteps(event.steps || []);
          setThinkingOpen(true);
        }
        if (event.phase === "plan_end" && event.steps) {
          setThinkingSteps(event.steps);
        }
        if (event.phase === "run_end") {
          // keep panel until final triggers list refresh
        }
      } else if (event.type === "context") {
        setContextSize(event.messages);
      } else if (event.type === "step") {
        setThinkingStepEvents((prev) => [...prev, event]);
      } else if (event.type === "delta") {
        setDeltaText((prev) => prev + event.content);
      } else if (event.type === "final" || event.type === "created") {
        // Finalization path: refresh and collapse thinking, but keep last run details for post-final inspection
        void listMessages.execute({ chatId, limit: 50 });
        setThinkingOpen(false);
        // Intentionally do NOT clear steps/delta/context to allow re-expand after final
      }
    };
    socket.on(eventName, onUpdate);

    return () => {
      socket.off(eventName, onUpdate);
      // Instruct server to remove this socket from the chatId subscriber set
      socket.emit("messageService:unsubscribe", { entryId: chatId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isConnected]);

  const messages = useMemo(
    () =>
      (
        listMessages as unknown as {
          data?: Array<{ id: string; role: string; content: string }>;
        }
      ).data || [],
    [listMessages]
  );

  if (!chatId) {
    return (
      <Stack
        spacing={1}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          p: 2,
        }}
      >
        <Typography color="text.secondary">No chat selected</Typography>
      </Stack>
    );
  }

  // Decide where to render the thinking panel: after the most recent user message
  const showThinking =
    !!deltaText || thinkingSteps.length > 0 || typeof contextSize === "number";
  const lastUserIndex = messages.reduce(
    (idx, m, i) => (m.role === "user" ? i : idx),
    -1
  );

  return (
    <Stack
      spacing={1}
      sx={{
        flexGrow: 1,
        minHeight: 0,
        overflowY: "auto",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
      }}
    >
      {/* Provide chatId to descendants for cancel handler */}
      <div data-chat-id={chatId || undefined} />
      {messages.map((m, i) => (
        <>
          <ChatMessageItem key={m.id} message={m} />
          {showThinking && i === lastUserIndex ? (
            <ThinkingPanel
              open={thinkingOpen}
              steps={thinkingSteps}
              stepEvents={thinkingStepEvents}
              contextMessages={contextSize}
              deltaText={deltaText}
              onToggle={() => setThinkingOpen((v) => !v)}
            />
          ) : null}
        </>
      ))}
      {/* Fallback if no messages yet but streaming started */}
      {messages.length === 0 && showThinking ? (
        <ThinkingPanel
          open={thinkingOpen}
          steps={thinkingSteps}
          stepEvents={thinkingStepEvents}
          contextMessages={contextSize}
          deltaText={deltaText}
          onToggle={() => setThinkingOpen((v) => !v)}
        />
      ) : null}
    </Stack>
  );
}
