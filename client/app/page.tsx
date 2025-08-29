"use client";

import React from "react";
import { Typography, Box, Button } from "@mui/material";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import MainLayout from "./components/layout/MainLayout";
import TypingTypography from "./components/display/TypingTypography";
import GameLanding from "./game/GameLanding";
import { GameProvider } from "./game/GameContext";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
      <GameProvider>
        <GameLanding />
      </GameProvider>
    </MainLayout>
  );
}
