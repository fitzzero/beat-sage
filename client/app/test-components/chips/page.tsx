"use client";

import * as React from "react";
import { Box, Typography, Divider, Stack, Chip, Avatar } from "@mui/material";
import TagIcon from "@mui/icons-material/Tag";

export default function ChipsTestPage() {
  const [clicked, setClicked] = React.useState<string | null>(null);
  return (
    <Box mt={4} mb={4}>
      <Typography variant="h5" gutterBottom>
        Chips
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={2}>
        <Stack direction="row" spacing={1}>
          <Chip label="Default" />
          <Chip label="Outlined" variant="outlined" />
          <Chip label="Primary" color="primary" />
          <Chip label="Secondary" color="secondary" />
          <Chip label="Success" color="success" />
          <Chip label="Error" color="error" />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Chip avatar={<Avatar>M</Avatar>} label="Avatar" />
          <Chip icon={<TagIcon />} label="With Icon" />
          <Chip label="Clickable" onClick={() => setClicked("clickable")} />
          <Chip label="Deletable" onDelete={() => setClicked("deleted")} />
          <Chip label="Outlined Deletable" variant="outlined" onDelete={() => setClicked("deleted-outlined")} />
        </Stack>
        {clicked ? <Typography variant="caption">Last action: {clicked}</Typography> : null}
      </Stack>
    </Box>
  );
}