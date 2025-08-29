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
import { useListLocations } from "../../hooks";

type LocationSelectDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (locationId: string) => void;
};

export default function LocationSelectDialog({
  open,
  onClose,
  onSelect,
}: LocationSelectDialogProps) {
  const listLocations = useListLocations();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    if (!open) return;
    if (!listLocations.isReady) return;
    void listLocations.execute({ page, pageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listLocations.isReady, page]);

  const locations =
    (
      listLocations as unknown as {
        data?: Array<{ id: string; name: string; difficulty: number }>;
      }
    ).data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) => l.name.toLowerCase().includes(q));
  }, [locations, query]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Select Location</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            label="Search locations"
            size="small"
            fullWidth
          />
          {!listLocations.isReady && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2">Connecting…</Typography>
            </Stack>
          )}
          <List disablePadding>
            {filtered.map((l) => (
              <ListItemButton key={l.id} onClick={() => onSelect(l.id)}>
                <ListItemText
                  primary={l.name}
                  secondary={`Difficulty: ${l.difficulty}`}
                />
              </ListItemButton>
            ))}
            {filtered.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No locations found.
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
