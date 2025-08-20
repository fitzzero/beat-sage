"use client";

import React from "react";
import {
  Box,
  Drawer,
  SwipeableDrawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Button,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import StyleIcon from "@mui/icons-material/Style";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMobile } from "../../hooks/useIsMobile";
import CurrentUserAvatar from "./CurrentUserAvatar";
import UserMenu from "./UserMenu";
import { useCurrentUserSub } from "../../hooks";
import { useTheme } from "@mui/material/styles";
import GradientTypography from "../display/GradientTypography";

export default function TestSideMenu() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { user } = useCurrentUserSub();
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const openMenu = (e: React.MouseEvent<HTMLElement>) =>
    setMenuAnchor(e.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  const toggleMobile = React.useCallback(
    (open: boolean) => () => setMobileOpen(open),
    []
  );

  const drawerUnits = 30; // 240px

  const routes = [
    {
      label: "Socket Inputs",
      href: "/test-components/socket-inputs-demo",
      icon: <ScienceIcon />,
    },
    {
      label: "Typography",
      href: "/test-components/typography",
      icon: <TextFieldsIcon />,
    },
    {
      label: "Buttons",
      href: "/test-components/buttons",
      icon: <ToggleOnIcon />,
    },
    { label: "Chips", href: "/test-components/chips", icon: <StyleIcon /> },
    {
      label: "Cards",
      href: "/test-components/cards",
      icon: <CreditCardIcon />,
    },
  ];

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ gap: 1 }}>
        <Image src="/logo.png" alt="Beat Sage" width={28} height={28} />
        <GradientTypography
          variant="h6"
          colors={[
            theme.palette.primary.main,
            theme.palette.secondary.main,
            theme.palette.text.primary,
          ]}
          animationSpeed={6}
          sx={{ lineHeight: 1 }}
        >
          Test Components
        </GradientTypography>
      </Toolbar>
      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <List disablePadding>
          {routes.map((route) => (
            <ListItemButton
              key={route.href}
              component={Link}
              href={route.href}
              selected={pathname === route.href}
            >
              {route.icon && <ListItemIcon>{route.icon}</ListItemIcon>}
              <ListItemText primary={route.label} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Button
          variant="text"
          color="inherit"
          onClick={openMenu}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            width: "100%",
            justifyContent: "flex-start",
          }}
        >
          <CurrentUserAvatar />
          <Typography variant="body1" noWrap>
            {user?.name || "Profile"}
          </Typography>
        </Button>
        <UserMenu anchorEl={menuAnchor} onClose={closeMenu} />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {isMobile ? (
        <>
          <Box
            onClick={toggleMobile(true)}
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100vh",
              width: (theme) => theme.spacing(1.5),
              bgcolor: "action.hover",
              opacity: 0.3,
              cursor: "pointer",
              zIndex: (theme) => theme.zIndex.drawer - 1,
            }}
            aria-label="Open navigation"
          />
          <SwipeableDrawer
            open={mobileOpen}
            onOpen={toggleMobile(true)}
            onClose={toggleMobile(false)}
            ModalProps={{ keepMounted: true }}
          >
            {content}
          </SwipeableDrawer>
        </>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: (theme) => theme.spacing(drawerUnits),
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: (theme) => theme.spacing(drawerUnits),
              boxSizing: "border-box",
            },
          }}
          open
        >
          {content}
        </Drawer>
      )}
    </Box>
  );
}
