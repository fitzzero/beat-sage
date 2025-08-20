"use client";

import { Avatar, Chip, Stack, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  senderUser?: { name?: string | null; image?: string | null } | null;
  senderAgent?: { name?: string | null } | null;
};

type ChatMessageItemProps = {
  message: ChatMessage;
};

export default function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isAssistant = message.role === "assistant";
  const authorName =
    message.senderUser?.name ||
    message.senderAgent?.name ||
    (isAssistant ? "Assistant" : "User");
  const avatarSrc = message.senderUser?.image || undefined;

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar src={avatarSrc} sx={{ width: 24, height: 24 }}>
          {authorName?.slice(0, 1) || (isAssistant ? "A" : "U")}
        </Avatar>
        <Typography variant="caption" color="text.secondary">
          {authorName}
        </Typography>
        <Chip label={message.role} size="small" variant="outlined" />
      </Stack>
      <Typography
        variant="body2"
        color={isAssistant ? "text.primary" : "text.secondary"}
      >
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </Typography>
    </Stack>
  );
}
