"use client";

import React from "react";
import { Menu, MenuItem } from "@mui/material";
import { signOut } from "next-auth/react";

type UserMenuProps = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
};

export default function UserMenu({ anchorEl, onClose }: UserMenuProps) {
  const open = Boolean(anchorEl);
  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose} keepMounted>
      <MenuItem onClick={onClose} component="a" href="/profile">
        Profile
      </MenuItem>
      <MenuItem
        onClick={() => {
          onClose();
          signOut();
        }}
      >
        Logout
      </MenuItem>
    </Menu>
  );
}
