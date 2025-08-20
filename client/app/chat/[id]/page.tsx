"use client";

import MainLayout from "../../components/layout/MainLayout";
import { Stack } from "@mui/material";
import ChatTitle from "../components/ChatTitle";
import ChatHistory from "../components/ChatHistory";
import ChatInput from "../components/ChatInput";

type PageProps = {
  params: { id: string };
};

export default function ChatByIdPage({ params }: PageProps) {
  const chatId = params?.id;
  return (
    <MainLayout>
      <Stack spacing={2} sx={{ mt: 2, flex: 1, minHeight: 0 }}>
        <ChatTitle chatId={chatId} />
        <ChatHistory chatId={chatId} />
        <ChatInput chatId={chatId} />
      </Stack>
    </MainLayout>
  );
}
