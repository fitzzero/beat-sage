"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Typography,
  Box,
  Button,
  Alert,
  TextField,
  CircularProgress,
} from "@mui/material";
import { useSession, signOut } from "next-auth/react";
import { useSocket } from "./socket/SocketProvider";
import { useRouter } from "next/navigation";
import { useCurrentUserSub, useCurrentUserUpdate } from "./hooks";
import MainLayout from "./components/layout/MainLayout";
import TypingTypography from "./components/display/TypingTypography";

export default function Home() {
  const { data: session, status } = useSession();
  const { socket, isConnected, connectionError, connect, disconnect } =
    useSocket();
  const router = useRouter();

  // Clean individual hooks - no room for error!
  const {
    user: userData,
    loading: userLoading,
    error: userError,
    isReady: subscriptionReady,
  } = useCurrentUserSub();

  const {
    updateUser,
    loading: updateLoading,
    error: updateError,
  } = useCurrentUserUpdate();

  // Local state for the input field
  const [nameInput, setNameInput] = useState("");
  const initialNameRef = useRef<string>("");

  // Update nameInput when userData changes
  useEffect(() => {
    if (userData?.name) {
      setNameInput(userData.name);
      initialNameRef.current = userData.name;
    }
  }, [userData]);

  // Handle input blur - clean and simple!
  const handleNameBlur = async () => {
    if (!userData) {
      return;
    }

    // Only update if the value actually changed
    if (nameInput !== initialNameRef.current) {
      await updateUser({ name: nameInput });
      // Note: UI will auto-update from subscription, no need to handle success callback
      initialNameRef.current = nameInput;
    }
  };

  if (status === "loading") {
    return (
      <MainLayout>
        <Box mt={4} mb={4}>
          <Typography>Loading...</Typography>
        </Box>
      </MainLayout>
    );
  }

  if (!session) {
    return (
      <MainLayout>
        <Box mt={4} mb={4}>
          <Typography variant="h2" component="h1" gutterBottom>
            Beat Sage
          </Typography>
          <Typography
            variant="h5"
            component="p"
            color="text.secondary"
            gutterBottom
          >
            Rhythm-based cultivation game
          </Typography>
          <TypingTypography
            variant="body1"
            color="primary"
            text={["Play to grow", "Sync to the beat", "Shape your path"]}
            typingSpeed={45}
            deletingSpeed={25}
            pauseDuration={1200}
            loop
            sx={{ display: "block", mt: 1 }}
          />
          <Button
            variant="contained"
            onClick={() => router.push("/auth/signin")}
            sx={{ mt: 2 }}
          >
            Sign In
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box mt={4} mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography
          variant="h6"
          component="p"
          color="text.secondary"
          gutterBottom
        >
          Welcome to your autonomous AI agent system
        </Typography>
        <TypingTypography
          variant="body1"
          color="secondary"
          text={[
            `Hello${userData?.name ? ", " + userData.name : ""}`,
            "Ready to orchestrate agents?",
          ]}
          typingSpeed={50}
          deletingSpeed={30}
          pauseDuration={1000}
          loop
          sx={{ display: "block", mb: 2 }}
        />

        <Box mt={3}>
          <Typography variant="h6" gutterBottom>
            User Profile
          </Typography>

          {/* User subscription status */}
          {userLoading && (
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <CircularProgress size={16} />
              <Typography variant="body2">Loading user data...</Typography>
            </Box>
          )}

          {userError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              User Error: {userError}
            </Alert>
          )}

          {/* Name input field - the main happy path implementation */}
          {userData && (
            <TextField
              label="Display Name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameBlur}
              disabled={updateLoading || !subscriptionReady}
              fullWidth
              sx={{ mb: 2 }}
              helperText={
                updateLoading
                  ? "Updating..."
                  : updateError
                  ? `Error: ${updateError}`
                  : "Changes will be saved automatically when you click away"
              }
              error={!!updateError}
            />
          )}

          {/* Socket connection status */}
          <Alert
            severity={
              isConnected ? "success" : connectionError ? "error" : "warning"
            }
            sx={{ mt: 2, mb: 2 }}
          >
            Socket Status:{" "}
            {isConnected
              ? "Connected to server"
              : connectionError
              ? `Error: ${connectionError}`
              : "Disconnected"}
          </Alert>

          {socket && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Socket ID: {socket.id}
            </Typography>
          )}

          <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={connect}
              disabled={isConnected}
            >
              Connect
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={disconnect}
              disabled={!isConnected}
            >
              Disconnect
            </Button>
          </Box>

          <Button variant="outlined" onClick={() => signOut()} sx={{ mt: 2 }}>
            Sign Out
          </Button>
        </Box>
      </Box>
    </MainLayout>
  );
}
