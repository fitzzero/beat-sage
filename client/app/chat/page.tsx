"use client";

import MainLayout from "../components/layout/MainLayout";
import { Stack } from "@mui/material";
import ChatTitle from "./components/ChatTitle";
import ChatHistory from "./components/ChatHistory";
import ChatInput from "./components/ChatInput";

// This page intentionally does not include a chat list. The list lives in the GlobalSideMenu.
export default function ChatPage() {
  return (
    <MainLayout>
      <Stack spacing={1} sx={{ mt: 2, flex: 1, minHeight: 0 }}>
        <ChatTitle />
        <ChatHistory />
        <ChatInput />
      </Stack>
    </MainLayout>
  );
}
