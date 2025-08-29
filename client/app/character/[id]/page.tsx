"use client";

import MainLayout from "../../components/layout/MainLayout";
import { Box, Typography } from "@mui/material";
import { useParams } from "next/navigation";

export default function CharacterDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id)
    ? params?.id[0]
    : (params?.id as string | undefined);

  return (
    <MainLayout>
      <Box sx={{ py: 4 }}>
        <Typography variant="h5" gutterBottom>
          Character
        </Typography>
        <Typography color="text.secondary">ID: {id}</Typography>
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Character details (coming soon).
        </Typography>
      </Box>
    </MainLayout>
  );
}
