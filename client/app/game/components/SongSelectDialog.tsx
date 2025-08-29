"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";
import { useListSongs } from "../../hooks";

type SongSelectDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (songId: string) => void;
};

export default function SongSelectDialog({
  open,
  onClose,
  onSelect,
}: SongSelectDialogProps) {
  const listSongs = useListSongs();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    if (!open) return;
    if (!listSongs.isReady) return;
    void listSongs.execute({ page, pageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listSongs.isReady, page]);

  const songs =
    (
      listSongs as unknown as {
        data?: Array<{ id: string; name: string; genreId: string }>;
      }
    ).data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.name.toLowerCase().includes(q));
  }, [songs, query]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Select Song</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            label="Search songs"
            size="small"
            fullWidth
          />
          {!listSongs.isReady && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2">Connecting…</Typography>
            </Stack>
          )}
          <List disablePadding>
            {filtered.map((s) => (
              <ListItemButton key={s.id} onClick={() => onSelect(s.id)}>
                <ListItemText primary={s.name} secondary={s.id} />
              </ListItemButton>
            ))}
            {filtered.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No songs found.
              </Typography>
            )}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
