"use client";

import React from "react";
import { Avatar, Badge, Typography } from "@mui/material";
import type { BadgeProps } from "@mui/material/Badge";
import { FiberManualRecord } from "@mui/icons-material";
import { useCurrentUserSub } from "../../hooks";
import { useSocket } from "../../socket/SocketProvider";

export default function CurrentUserAvatar() {
  const { user, loading, error } = useCurrentUserSub();
  const { isConnected } = useSocket();

  // Get user initials for fallback
  const getInitials = (name?: string | null) => {
    if (!name) {
      return "U";
    }
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Connection status badge color
  const connectionColor: "success" | "error" = isConnected
    ? "success"
    : "error";
  // const connectionText = isConnected ? "Connected" : "Disconnected";

  const badgeColor: BadgeProps["color"] = loading
    ? "warning"
    : error
    ? "error"
    : connectionColor;

  return (
    <Badge
      badgeContent={<FiberManualRecord sx={{ fontSize: 8 }} />}
      color={badgeColor}
      overlap="circular"
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      variant="dot"
    >
      <Avatar src={user?.image || undefined} sx={{ width: 32, height: 32 }}>
        {loading ? (
          <Typography variant="caption">...</Typography>
        ) : error ? (
          "!"
        ) : (
          getInitials(user?.name)
        )}
      </Avatar>
    </Badge>
  );
}
