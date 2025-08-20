"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Stack,
  IconButton,
  Button,
  Box,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  useListMyChats,
  useCreateChat,
  useAdminDeleteChat,
  useCurrentUserSub,
} from "../../hooks";

export default function RecentChats() {
  const listMyChats = useListMyChats();
  const { isReady: isListReady, execute: executeListMyChats } = listMyChats;
  const [expanded, setExpanded] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const router = useRouter();
  const createChat = useCreateChat();
  const deleteChat = useAdminDeleteChat();
  const { user } = useCurrentUserSub();
  const pathname = usePathname();

  // Fetch once when socket becomes ready (avoid re-fetch loops)
  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (!isListReady || didInitialFetchRef.current) {
      return;
    }
    didInitialFetchRef.current = true;
    void executeListMyChats({ page: 1, pageSize: 20 });
  }, [isListReady, executeListMyChats]);

  // Fetch more when expanded or pageSize increases
  useEffect(() => {
    if (!expanded) {
      return;
    }
    void executeListMyChats({ page: 1, pageSize });
  }, [expanded, pageSize, executeListMyChats]);

  const chats =
    (listMyChats as unknown as { data?: Array<{ id: string; title: string }> })
      .data || [];
  const visible = expanded ? chats : chats.slice(0, 3);

  const handleLoadMore = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      return;
    }
    // Already expanded; try to fetch more from the server by increasing pageSize
    setPageSize((s) => s + 20);
  }, [expanded]);

  const handleNewChat = useCallback(async () => {
    const res = (await createChat.execute({ title: "New chat" })) as {
      id: string;
    } | null;
    if (res?.id) {
      router.push(`/chat/${res.id}`);
      // Ensure list includes the new chat
      void executeListMyChats({ page: 1, pageSize: Math.max(pageSize, 20) });
    }
  }, [createChat, router, executeListMyChats, pageSize]);

  const hasServiceAdmin =
    ((user?.serviceAccess as unknown as Record<
      string,
      "Read" | "Moderate" | "Admin"
    >) || {})["chatService"] === "Admin";
  const canDelete = hasServiceAdmin || true; // Own chats are created by the user and grant Admin in ACL

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const res = await deleteChat.execute({ id });
      if (res) {
        void executeListMyChats({ page: 1, pageSize });
      }
    },
    [deleteChat, executeListMyChats, pageSize]
  );

  return (
    <Stack sx={{ py: 1 }} spacing={0.5}>
      <List disablePadding>
        {visible.map((c) => (
          <ListItemButton
            key={c.id}
            component={Link}
            href={`/chat/${c.id}`}
            selected={pathname === `/chat/${c.id}`}
            sx={{
              pl: 4,
              display: "flex",
              alignItems: "center",
              ":hover .deleteBtn": { opacity: 1, pointerEvents: "auto" },
            }}
          >
            <ListItemText primary={<Typography noWrap>{c.title}</Typography>} />
            {canDelete && (
              <IconButton
                size="small"
                edge="end"
                aria-label="Delete chat"
                onClick={(e) => void handleDelete(e, c.id)}
                className="deleteBtn"
                sx={{
                  ml: 1,
                  opacity: 0,
                  transition: "opacity 0.2s",
                  pointerEvents: "none",
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </ListItemButton>
        ))}
        {/* Action: Load more */}
        {chats.length > 3 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
            <Button
              onClick={handleLoadMore}
              color="primary"
              variant="outlined"
              size="small"
            >
              Load more
            </Button>
          </Box>
        )}
        {/* Action: New chat */}
        <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
          <Button
            onClick={handleNewChat}
            color="primary"
            variant="outlined"
            size="small"
          >
            New chat
          </Button>
        </Box>
      </List>
    </Stack>
  );
}
