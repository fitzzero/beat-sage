"use client";

import * as React from "react";
import { Box, Typography, Divider, Stack, Button, ButtonGroup, IconButton } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";

export default function ButtonsTestPage() {
  return (
    <Box mt={4} mb={4}>
      <Typography variant="h5" gutterBottom>
        Buttons
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={3}>
        <Stack direction="row" spacing={2}>
          <Button variant="text">Text</Button>
          <Button variant="contained">Contained</Button>
          <Button variant="outlined">Outlined</Button>
        </Stack>

        <Stack direction="row" spacing={2}>
          <Button size="small" variant="contained">Small</Button>
          <Button size="medium" variant="contained">Medium</Button>
          <Button size="large" variant="contained">Large</Button>
        </Stack>

        <Stack direction="row" spacing={2}>
          <Button color="primary" variant="contained">Primary</Button>
          <Button color="secondary" variant="contained">Secondary</Button>
          <Button color="success" variant="contained">Success</Button>
          <Button color="error" variant="contained">Error</Button>
          <Button color="info" variant="contained">Info</Button>
          <Button color="warning" variant="contained">Warning</Button>
        </Stack>

        <Stack direction="row" spacing={2}>
          <Button startIcon={<SaveIcon />} variant="contained">Save</Button>
          <Button endIcon={<DeleteIcon />} variant="outlined" color="error">Delete</Button>
          <IconButton aria-label="delete" color="error"><DeleteIcon /></IconButton>
        </Stack>

        <ButtonGroup variant="outlined" aria-label="outlined button group">
          <Button>One</Button>
          <Button>Two</Button>
          <Button>Three</Button>
        </ButtonGroup>
      </Stack>
    </Box>
  );
}