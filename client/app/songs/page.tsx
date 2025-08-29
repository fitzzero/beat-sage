"use client";

import MainLayout from "../components/layout/MainLayout";
import { Box, Typography } from "@mui/material";

export default function SongsPage() {
  return (
    <MainLayout>
      <Box sx={{ py: 4 }}>
        <Typography variant="h5" gutterBottom>
          Songs
        </Typography>
        <Typography color="text.secondary">
          Song index and search (coming soon).
        </Typography>
      </Box>
    </MainLayout>
  );
}
