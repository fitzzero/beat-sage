"use client";

import MainLayout from "../components/layout/MainLayout";
import { Box, Typography } from "@mui/material";

export default function CharactersPage() {
  return (
    <MainLayout>
      <Box sx={{ py: 4 }}>
        <Typography variant="h5" gutterBottom>
          Characters
        </Typography>
        <Typography color="text.secondary">
          Manage your characters (coming soon).
        </Typography>
      </Box>
    </MainLayout>
  );
}
