"use client";

import React from "react";
import { Container, Stack, CircularProgress, Typography, Button, Alert } from "@mui/material";
import TestSideMenu from "./TestSideMenu";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSocket, useCurrentUserSub } from "../../hooks";
import type { User } from "@shared/types";

function hasServiceAcl(
  user: User | null | undefined,
  serviceName: string,
  minLevel: "Read" | "Moderate" | "Admin"
): boolean {
  if (!user?.serviceAccess) {
    return false;
  }
  const levels = ["Read", "Moderate", "Admin"] as const;
  const level = (user.serviceAccess as unknown as Record<string, "Read" | "Moderate" | "Admin">)[serviceName];
  const effectiveLevel = level ?? "Read";
  return levels.indexOf(effectiveLevel) >= levels.indexOf(minLevel);
}

type TestLayoutProps = {
  children: React.ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
};

export default function TestLayout({ children, maxWidth = "md" }: TestLayoutProps) {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const { isConnected, connectionError, connect } = useSocket();
  const { user, error: userError } = useCurrentUserSub();
  const isAdmin = hasServiceAcl(user, "userService", "Admin");

  return (
    <Stack direction="row">
      <TestSideMenu />
      <Container maxWidth={maxWidth} sx={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
        {!isAuthed ? (
          <Stack spacing={2} sx={{ py: 6 }}>
            <h3>Please sign in to continue</h3>
            <Link href="/auth/signin">Go to Sign In</Link>
          </Stack>
        ) : !isConnected ? (
          <Stack spacing={2} sx={{ py: 6 }} alignItems="center">
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              {connectionError ? `Connection error: ${connectionError}` : "Connecting to realtime services..."}
            </Typography>
            {connectionError && (
              <Button onClick={connect} variant="outlined" size="small">
                Retry
              </Button>
            )}
          </Stack>
        ) : !isAdmin ? (
          <Stack spacing={2} sx={{ py: 6 }}>
            {userError ? <Alert severity="error">{userError}</Alert> : null}
            <Typography variant="h6">Admins only</Typography>
            <Typography variant="body2" color="text.secondary">
              You need userService Admin access to view the test components.
            </Typography>
            <Link href="/">Go Home</Link>
          </Stack>
        ) : (
          children
        )}
      </Container>
    </Stack>
  );
}