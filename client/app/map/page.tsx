"use client";

import MainLayout from "../components/layout/MainLayout";
import { Box, Typography } from "@mui/material";

export default function MapPage() {
  return (
    <MainLayout>
      <Box sx={{ py: 4 }}>
        <Typography variant="h5" gutterBottom>
          Map
        </Typography>
        <Typography color="text.secondary">
          Locations overview (coming soon).
        </Typography>
      </Box>
    </MainLayout>
  );
}
