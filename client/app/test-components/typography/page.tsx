"use client";

import * as React from "react";
import { Box, Typography, Divider, Stack } from "@mui/material";

export default function TypographyTestPage() {
  return (
    <Box mt={4} mb={4}>
      <Typography variant="h5" gutterBottom>
        Typography
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={2}>
        <Typography variant="h1">H1 Heading</Typography>
        <Typography variant="h2">H2 Heading</Typography>
        <Typography variant="h3">H3 Heading</Typography>
        <Typography variant="h4">H4 Heading</Typography>
        <Typography variant="h5">H5 Heading</Typography>
        <Typography variant="h6">H6 Heading</Typography>
        <Typography variant="subtitle1">Subtitle 1</Typography>
        <Typography variant="subtitle2">Subtitle 2</Typography>
        <Typography variant="body1">Body 1 - Regular paragraph text showcasing the base font size.</Typography>
        <Typography variant="body2">Body 2 - Secondary text for longer descriptions and notes.</Typography>
        <Typography variant="caption">Caption - Small helper text</Typography>
        <Typography variant="overline" display="block">OVERLINE</Typography>
      </Stack>
    </Box>
  );
}