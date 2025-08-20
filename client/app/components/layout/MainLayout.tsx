"use client";

import React from "react";
import {
  Container,
  Stack,
  CircularProgress,
  Typography,
  Button,
} from "@mui/material";
import GlobalSideMenu from "./GlobalSideMenu";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSocket } from "../../hooks";

type MainLayoutProps = {
  children: React.ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
};

export default function MainLayout({
  children,
  maxWidth = "md",
}: MainLayoutProps) {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const { isConnected, connectionError, connect } = useSocket();
  return (
    <Stack direction="row">
      <GlobalSideMenu />
      <Container
        maxWidth={maxWidth}
        sx={{ display: "flex", flexDirection: "column", height: "100dvh" }}
      >
        {!isAuthed ? (
          <Stack spacing={2} sx={{ py: 6 }}>
            <h3>Please sign in to continue</h3>
            <Link href="/auth/signin">Go to Sign In</Link>
          </Stack>
        ) : !isConnected ? (
          <Stack spacing={2} sx={{ py: 6 }} alignItems="center">
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              {connectionError
                ? `Connection error: ${connectionError}`
                : "Connecting to realtime services..."}
            </Typography>
            {connectionError && (
              <Button onClick={connect} variant="outlined" size="small">
                Retry
              </Button>
            )}
          </Stack>
        ) : (
          children
        )}
      </Container>
    </Stack>
  );
}
