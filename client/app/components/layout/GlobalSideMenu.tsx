"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Box,
  Drawer,
  SwipeableDrawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Toolbar,
  Typography,
  Button,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HomeIcon from "@mui/icons-material/Home";
// Removed Chat from side menu per new Game-first nav
import DashboardIcon from "@mui/icons-material/Dashboard";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import MemoryIcon from "@mui/icons-material/Memory";
import PsychologyIcon from "@mui/icons-material/Psychology";
import PeopleIcon from "@mui/icons-material/People";
import ForumIcon from "@mui/icons-material/Forum";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMobile } from "../../hooks/useIsMobile";
import CurrentUserAvatar from "./CurrentUserAvatar";
import UserMenu from "./UserMenu";
import { useCurrentUserSub } from "../../hooks";
// Recent chats removed; add RecentCharacters below
import RecentCharacters from "./RecentCharacters";
import { User } from "@shared/types";
import { useTheme } from "@mui/material/styles";
import GradientTypography from "../display/GradientTypography";

type NavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  children?: NavItem[];
  isVisible?: (user?: User | null) => boolean;
  details?: React.ReactNode;
};

function hasServiceAcl(
  user: User | null | undefined,
  serviceName: string,
  minLevel: "Read" | "Moderate" | "Admin"
): boolean {
  if (!user?.serviceAccess) {
    return false;
  }
  const levels = ["Read", "Moderate", "Admin"] as const;
  const level = (
    user.serviceAccess as unknown as Record<
      string,
      "Read" | "Moderate" | "Admin"
    >
  )[serviceName];
  const effectiveLevel = level ?? "Read";
  return levels.indexOf(effectiveLevel) >= levels.indexOf(minLevel);
}

export default function GlobalSideMenu() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { user } = useCurrentUserSub();
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const openMenu = (e: React.MouseEvent<HTMLElement>) =>
    setMenuAnchor(e.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  const toggleMobile = useCallback(
    (open: boolean) => () => setMobileOpen(open),
    []
  );

  const drawerUnits = 30; // 30 * 8 = 240px using theme spacing

  const routes: NavItem[] = useMemo(() => {
    const canModerate = (service: string) => () =>
      hasServiceAcl(user, service, "Moderate");
    const canAdmin = () => hasServiceAcl(user, "userService", "Admin");
    return [
      { label: "Game", href: "/game", icon: <HomeIcon /> },
      {
        label: "Characters",
        href: "/characters",
        icon: <PeopleIcon />,
        details: <RecentCharacters />,
      },
      {
        label: "Songs",
        href: "/songs",
        icon: <MemoryIcon />, // simple music-ish icon replacement
      },
      {
        label: "Map",
        href: "/map",
        icon: <DashboardIcon />, // placeholder icon for map
      },
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: <DashboardIcon />,
        isVisible: canAdmin, // Gate entire section to admins for now
        children: [
          {
            label: "Health",
            href: "/dashboard/health",
            icon: <HealthAndSafetyIcon />,
            isVisible: canModerate("userService"),
          },
          {
            label: "Models",
            href: "/dashboard/models",
            icon: <MemoryIcon />,
            isVisible: canModerate("modelService"),
          },
          {
            label: "Agents",
            href: "/dashboard/agents",
            icon: <PsychologyIcon />,
            isVisible: canModerate("agentService"),
          },
          {
            label: "Users",
            href: "/dashboard/users",
            icon: <PeopleIcon />,
            isVisible: canModerate("userService"),
          },
          {
            label: "Chats",
            href: "/dashboard/chats",
            icon: <ForumIcon />,
            isVisible: canModerate("chatService"),
          },
        ],
      },
    ];
  }, [user]);

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Branding */}
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
          Beat Sage
        </GradientTypography>
      </Toolbar>
      <Divider />

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <List disablePadding>
          {routes
            .filter((r) => (r.isVisible ? r.isVisible(user) : true))
            .map((route) => {
              const partyRegex =
                /^\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
              const isSelected =
                route.href === "/game"
                  ? pathname === "/game" ||
                    pathname === "/" ||
                    partyRegex.test(pathname)
                  : pathname === route.href;
              const hasChildren = route.children && route.children.length > 0;
              const hasDetails = !!route.details || hasChildren;
              if (!hasDetails) {
                return (
                  <ListItemButton
                    key={route.href}
                    component={Link}
                    href={route.href}
                    selected={isSelected}
                  >
                    {route.icon && <ListItemIcon>{route.icon}</ListItemIcon>}
                    <ListItemText primary={route.label} />
                  </ListItemButton>
                );
              }

              const visibleChildren = (route.children || []).filter((c) =>
                c.isVisible ? c.isVisible(user) : true
              );

              const parentSelected = pathname.startsWith(route.href);
              return (
                <Accordion
                  key={route.href}
                  disableGutters
                  square
                  defaultExpanded={parentSelected}
                  sx={{
                    bgcolor: "transparent",
                    backgroundImage: "none",
                    boxShadow: "none",
                    "&:hover": {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <AccordionSummary
                    expandIcon={hasDetails ? <ExpandMoreIcon /> : undefined}
                    sx={{
                      px: 2,
                      py: 1,
                      minHeight: (theme) => theme.spacing(6),
                      "& .MuiAccordionSummary-content": { m: 0 },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      {/* Use ListItemIcon to exactly match non-accordion rows */}
                      <ListItemIcon
                        sx={{ minWidth: (theme) => theme.spacing(7) }}
                      >
                        {route.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography
                            component={Link}
                            href={route.href}
                            style={{ textDecoration: "none", color: "inherit" }}
                          >
                            {route.label}
                          </Typography>
                        }
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ py: 0 }}>
                    {route.details ? (
                      route.details
                    ) : (
                      <List disablePadding>
                        {visibleChildren.map((child) => (
                          <ListItemButton
                            key={child.href}
                            component={Link}
                            href={child.href}
                            selected={pathname === child.href}
                            sx={{ pl: 4 }}
                          >
                            {child.icon && (
                              <ListItemIcon>{child.icon}</ListItemIcon>
                            )}
                            <ListItemText primary={child.label} />
                          </ListItemButton>
                        ))}
                      </List>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
        </List>
      </Box>

      <Divider />

      {/* User section at bottom */}
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
          {/* Edge indicator */}
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
