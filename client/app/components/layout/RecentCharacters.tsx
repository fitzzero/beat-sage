"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Stack,
  Button,
  Box,
} from "@mui/material";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCreateCharacter, useListMyCharacters } from "../../hooks/character/useCharacterMethods";

export default function RecentCharacters() {
  const listMine = useListMyCharacters();
  const { isReady: isListReady, execute: executeList } = listMine;
  const [expanded, setExpanded] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const router = useRouter();
  const createCharacter = useCreateCharacter();
  const pathname = usePathname();

  // Fetch once when socket becomes ready (avoid re-fetch loops)
  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (!isListReady || didInitialFetchRef.current) {
      return;
    }
    didInitialFetchRef.current = true;
    void executeList({ page: 1, pageSize: 20 });
  }, [isListReady, executeList]);

  // Fetch more when expanded or pageSize increases
  useEffect(() => {
    if (!expanded) {
      return;
    }
    void executeList({ page: 1, pageSize });
  }, [expanded, pageSize, executeList]);

  const characters =
    (listMine as unknown as { data?: Array<{ id: string; name: string }> })
      .data || [];
  const visible = expanded ? characters : characters.slice(0, 3);

  const handleLoadMore = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      return;
    }
    setPageSize((s) => s + 20);
  }, [expanded]);

  const handleCreate = useCallback(async () => {
    const res = (await createCharacter.execute({ name: "Adventurer" })) as {
      id: string;
    } | null;
    if (res?.id) {
      router.push(`/character/${res.id}`);
      void executeList({ page: 1, pageSize: Math.max(pageSize, 20) });
    }
  }, [createCharacter, router, executeList, pageSize]);

  return (
    <Stack sx={{ py: 1 }} spacing={0.5}>
      <List disablePadding>
        {visible.map((c) => (
          <ListItemButton
            key={c.id}
            component={Link}
            href={`/character/${c.id}`}
            selected={pathname === `/character/${c.id}`}
            sx={{ pl: 4 }}
          >
            <ListItemText primary={<Typography noWrap>{c.name}</Typography>} />
          </ListItemButton>
        ))}
        {characters.length > 3 && (
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
        <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
          <Button
            onClick={handleCreate}
            color="primary"
            variant="outlined"
            size="small"
          >
            Create Character
          </Button>
        </Box>
      </List>
    </Stack>
  );
}
