"use client";

import { Divider, Stack } from "@mui/material";
import { useUpdateChatTitle, useChatSub } from "../../hooks";
import InlineEditTypography from "../../components/inputs/InlineEditTypography";

type ChatTitleProps = {
  chatId?: string | null;
};

export default function ChatTitle({ chatId }: ChatTitleProps) {
  const { chat, access } = useChatSub(chatId ?? null);
  const updateTitle = useUpdateChatTitle();
  const state = (chat as { id: string; title: string } | null) || null;
  const canUpdate = access === "Moderate" || access === "Admin";

  return (
    <Stack spacing={1}>
      <InlineEditTypography
        variant="h6"
        state={state}
        update={async (patch) => {
          if (!state?.id) {
            return undefined;
          }
          const next = await updateTitle.execute({
            id: state.id,
            title: String((patch as { title?: unknown }).title ?? ""),
          });
          return (next as unknown as typeof state) ?? state;
        }}
        property={"title" as never}
        canUpdate={canUpdate}
      />
      <Divider />
    </Stack>
  );
}
