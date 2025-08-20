"use client";

import * as React from "react";
import { Box, Stack, Typography, Alert } from "@mui/material";
import { useCurrentUserSub, useCurrentUserUpdate } from "../../hooks";
import { SocketTextField } from "../../components/inputs/SocketTextField";

export default function SocketInputsDemoPage() {
  const { user, loading: subLoading, error: subError } = useCurrentUserSub();
  const { updateUser, loading: updateLoading, error: updateError } = useCurrentUserUpdate();

  return (
    <Box mt={4} mb={4}>
      <Typography variant="h5" gutterBottom>
        Socket-aware Inputs Demo
      </Typography>
      {subError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Subscription error: {subError}
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        <SocketTextField
          state={user}
          update={updateUser}
          property={"name"}
          label="Display name"
          fullWidth
          helperText={updateLoading ? "Updating..." : updateError || undefined}
          error={!!updateError}
          disabled={subLoading}
        />

        <SocketTextField
          state={user}
          update={updateUser}
          property={"username"}
          label="Username"
          fullWidth
          helperText={updateLoading ? "Updating..." : updateError || undefined}
          error={!!updateError}
          disabled={subLoading}
        />
      </Stack>
    </Box>
  );
}
