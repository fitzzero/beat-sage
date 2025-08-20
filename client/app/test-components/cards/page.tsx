"use client";

import * as React from "react";
import { Box, Typography, Divider, Stack, Card, CardActions, CardContent, CardHeader, CardMedia, Button, Avatar, IconButton } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";

export default function CardsTestPage() {
  return (
    <Box mt={4} mb={4}>
      <Typography variant="h5" gutterBottom>
        Cards
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={3}>
        <Card>
          <CardHeader title="Basic Card" subheader="January 1, 2025" />
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              This is a simple card with a header and content.
            </Typography>
          </CardContent>
          <CardActions>
            <Button size="small">Action</Button>
            <Button size="small" color="secondary">Secondary</Button>
          </CardActions>
        </Card>

        <Card>
          <CardHeader
            avatar={<Avatar aria-label="recipe">R</Avatar>}
            action={<IconButton aria-label="settings"><MoreVertIcon /></IconButton>}
            title="Card with Avatar"
            subheader="September 14, 2025"
          />
          <CardMedia
            component="img"
            height="140"
            image="https://picsum.photos/600/300"
            alt="Random"
          />
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              A card including media, content, and actions.
            </Typography>
          </CardContent>
          <CardActions>
            <Button size="small">Share</Button>
            <Button size="small">Learn More</Button>
          </CardActions>
        </Card>
      </Stack>
    </Box>
  );
}