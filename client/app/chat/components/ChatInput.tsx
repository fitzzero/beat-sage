"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Stack,
  TextField,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import {
  usePostMessage,
  useStreamAssistantMessage,
  useListModels,
  useAttachAgent,
  useCreateAgent,
  useListAgents,
  useUpdateAgent,
  useChatSub,
  useSubscription,
} from "../../hooks";
import { useThinkingStream } from "../../hooks/chat/useThinkingStream";

type ChatInputProps = {
  chatId?: string | null;
};

export default function ChatInput({ chatId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const postMessage = usePostMessage();
  const streamAssistant = useStreamAssistantMessage();
  const listAgents = useListAgents();
  const createAgent = useCreateAgent();
  const listModels = useListModels();
  const attachAgent = useAttachAgent();
  const updateAgent = useUpdateAgent();
  const { chat } = useChatSub(chatId ?? null);
  const agentId = (chat as { agentId?: string | null } | null)?.agentId ?? null;
  const { data: agentData } = useSubscription("agentService", agentId);
  const thinking = useThinkingStream(chatId);

  const [agentMenuEl, setAgentMenuEl] = useState<null | HTMLElement>(null);
  const [modelMenuEl, setModelMenuEl] = useState<null | HTMLElement>(null);
  const [activeAgent, setActiveAgent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [activeModel, setActiveModel] = useState<{
    id: string;
    displayName: string;
    provider: string;
    modelKey: string;
  } | null>(null);

  const openAgentMenu = useCallback(
    async (e: React.MouseEvent<HTMLElement>) => {
      setAgentMenuEl(e.currentTarget);
      if (!listAgents.data && listAgents.isReady) {
        void listAgents.execute({ page: 1, pageSize: 50 });
      }
    },
    [listAgents]
  );
  const closeAgentMenu = useCallback(() => setAgentMenuEl(null), []);

  const openModelMenu = useCallback(
    async (e: React.MouseEvent<HTMLElement>) => {
      setModelMenuEl(e.currentTarget);
      if (!listModels.data && listModels.isReady) {
        void listModels.execute({ page: 1, pageSize: 50 });
      }
    },
    [listModels]
  );
  const closeModelMenu = useCallback(() => setModelMenuEl(null), []);

  const handleSend = useCallback(async () => {
    if (!chatId || !message.trim()) {
      return;
    }
    await postMessage.execute({ chatId, content: message.trim() });
    setMessage("");
  }, [chatId, message, postMessage]);

  const handleStream = useCallback(async () => {
    const trimmed = message.trim();
    if (!chatId || !trimmed) {
      return;
    }
    // Persist the user's message first so the conversation history reflects their input
    await postMessage.execute({ chatId, content: trimmed, role: "user" });
    // Then trigger assistant streaming using the same prompt
    await streamAssistant.execute({
      chatId,
      prompt: trimmed,
      modelId: activeModel?.id,
      agentId: activeAgent?.id,
    });
    setMessage("");
    // Ensure the top drawer/panel is visible at the start of a run
    thinking.setOpen(true);
  }, [
    chatId,
    message,
    postMessage,
    streamAssistant,
    activeAgent?.id,
    activeModel?.id,
    thinking,
  ]);

  const handleSendSmart = useCallback(async () => {
    if (activeAgent || activeModel) {
      await handleStream();
    } else {
      await handleSend();
    }
  }, [activeAgent, activeModel, handleStream, handleSend]);

  const onPickAgent = useCallback(
    async (opt: { id: string; name: string } | null) => {
      setActiveAgent(opt);
      closeAgentMenu();
      if (chatId) {
        await attachAgent.execute({ id: chatId, agentId: opt?.id ?? null });
      }
    },
    [attachAgent, chatId, closeAgentMenu]
  );

  const onCreateAgent = useCallback(async () => {
    const created = (await createAgent.execute({ name: "New Agent" })) as {
      id: string;
    } | null;
    if (created) {
      setActiveAgent({ id: created.id, name: "New Agent" });
      if (chatId) {
        await attachAgent.execute({ id: chatId, agentId: created.id });
      }
      void listAgents.execute({ page: 1, pageSize: 50 });
    }
  }, [createAgent, attachAgent, chatId, listAgents]);

  // Sync activeAgent from chat + agent subscription
  useEffect(() => {
    if (agentId) {
      const name = (agentData as { name?: string } | null)?.name || "Agent";
      setActiveAgent({ id: agentId, name });
    } else {
      setActiveAgent(null);
    }
  }, [agentId, agentData]);

  // Keep model selection synced with agent.defaultModelId
  useEffect(() => {
    const defaultModelId =
      (agentData as { defaultModelId?: string | null } | null)
        ?.defaultModelId ?? null;
    if (!defaultModelId) {
      setActiveModel(null);
      return;
    }
    const ensure = async () => {
      if (!listModels.data && listModels.isReady) {
        await listModels.execute({ page: 1, pageSize: 50 });
      }
      const models =
        (listModels.data as Array<{
          id: string;
          displayName: string;
          provider: string;
          modelKey: string;
        }>) || [];
      const found = models.find((m) => m.id === defaultModelId);
      if (found) {
        setActiveModel(found);
      }
    };
    void ensure();
  }, [agentData, listModels]);

  return (
    <Stack spacing={1} sx={{ flexShrink: 0, pb: 2 }}>
      <Box sx={{ position: "relative" }}>
        <TextField
          fullWidth
          size="small"
          label="Message"
          multiline
          minRows={2}
          maxRows={8}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSendSmart();
            }
          }}
          sx={{
            "& .MuiInputBase-inputMultiline": {
              paddingBottom: (theme) => theme.spacing(4),
            },
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pointerEvents: "none",
          }}
        >
          <Stack direction="row" spacing={1} sx={{ pointerEvents: "auto" }}>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={openAgentMenu}
            >
              <Typography variant="caption">
                Agent: {activeAgent?.name ?? "None"}
              </Typography>
            </Button>
            <Menu
              anchorEl={agentMenuEl}
              open={!!agentMenuEl}
              onClose={closeAgentMenu}
            >
              <MenuItem onClick={() => onPickAgent(null)}>None</MenuItem>
              {(
                (listAgents.data as Array<{ id: string; name: string }>) || []
              ).map((a) => (
                <MenuItem key={a.id} onClick={() => onPickAgent(a)}>
                  {a.name}
                </MenuItem>
              ))}
              <MenuItem onClick={onCreateAgent}>Create New</MenuItem>
            </Menu>

            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={openModelMenu}
            >
              <Typography variant="caption">
                Model: {activeModel?.displayName ?? "Default"}
              </Typography>
            </Button>
            <Menu
              anchorEl={modelMenuEl}
              open={!!modelMenuEl}
              onClose={closeModelMenu}
            >
              {(
                (listModels.data as Array<{
                  id: string;
                  displayName: string;
                  provider: string;
                  modelKey: string;
                }>) || []
              ).map((m) => (
                <MenuItem
                  key={m.id}
                  onClick={() => {
                    setActiveModel(m);
                    if (activeAgent) {
                      void updateAgent.execute({
                        id: activeAgent.id,
                        data: { defaultModelId: m.id },
                      });
                    }
                    closeModelMenu();
                  }}
                >
                  {m.displayName}
                </MenuItem>
              ))}
            </Menu>
          </Stack>

          <Box sx={{ pointerEvents: "auto" }}>
            <IconButton
              color="primary"
              onClick={() => void handleSendSmart()}
              disabled={!chatId}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}
