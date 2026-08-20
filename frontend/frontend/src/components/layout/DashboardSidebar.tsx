import {
  ChevronLeftRounded,
  ChevronRightRounded,
} from "@mui/icons-material";

import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";

import { NavLink } from "react-router-dom";

import { navigation } from "../../routes/navigation";

import logo from "../../assets/Eskom-logo-white.gif";

/**
 * =====================================================
 * DASHBOARD SIDEBAR
 * =====================================================
 * Redesigned from scratch: a compact Eskom-navy rail with the
 * official logo, grouped navigation, a system-health footer and
 * a collapsible drawer for desktop. Active route is highlighted
 * with an Eskom-blue glow bar.
 */
interface DashboardSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const DashboardSidebar = ({
  collapsed = false,
  onToggle,
}: DashboardSidebarProps) => {
  return (
    <Box
      className="eskom-sidebar"
      component="nav"
      sx={{
        width: collapsed ? 84 : 268,
        height: "100vh",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "#0A1C38",
        color: "#fff",
        borderRight: "1px solid rgba(255,255,255,0.08)",

        /*
         * The rail is a full-height panel flush with the window edge —
         * it must stay square. (A global CSS rule used to force a 12px
         * radius on every emotion-styled div, which rounded it.)
         */
        borderRadius: 0,

        transition: "width .28s cubic-bezier(0.16,1,0.3,1)",
        overflow: "hidden",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Brand */}
      <Box
        sx={{
          px: collapsed ? 1.5 : 3,
          py: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 1,
        }}
      >
        <Box
          component="img"
          src={logo}
          alt="Eskom"
          sx={{
            width: collapsed ? 40 : 168,
            maxHeight: 40,
            objectFit: "contain",
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.35))",
            transition: "width .28s ease",
          }}
        />

        {/* Collapse / expand toggle — shows a chevron in BOTH states */}
        <Tooltip title={collapsed ? "Expand menu" : "Collapse menu"}>
          <IconButton onClick={onToggle} size="small" sx={{ color: "rgba(255,255,255,.7)" }}>
            {collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* App title */}
      {!collapsed && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: "#6C87A8", letterSpacing: "0.14em" }}
          >
            Coal Stockpile
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(255,255,255,.72)", fontWeight: 600, mt: 0.25 }}
          >
            Forecasting Platform
          </Typography>
        </Box>
      )}

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mx: collapsed ? 1.5 : 3 }} />

      {/* Navigation */}
      <List sx={{ px: collapsed ? 1.25 : 2, py: 2, flex: 1, overflowY: "auto" }}>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Tooltip key={item.path} title={collapsed ? item.title : ""} placement="right">
              <ListItemButton
                component={NavLink}
                to={item.path}
                sx={{
                  borderRadius: "10px",
                  mb: 0.75,
                  py: collapsed ? 1.4 : 1.25,
                  px: collapsed ? 1.25 : 1.75,
                  color: "rgba(255,255,255,.66)",
                  position: "relative",
                  transition: "background .18s ease, color .18s ease",

                  "&.active": {
                    bgcolor: "rgba(24,144,215,0.16)",
                    color: "#fff",

                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: "22%",
                      bottom: "22%",
                      width: 4,
                      borderRadius: "12px",
                      bgcolor: "#1890d7",
                    },
                  },

                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.08)",
                    color: "#fff",
                  },
                }}
              >
                <ListItemIcon sx={{ color: "inherit", minWidth: collapsed ? "100%" : 40, justifyContent: collapsed ? "center" : "flex-start" }}>
                  <Icon fontSize="small" />
                </ListItemIcon>

                {!collapsed && (
                  <ListItemText
                    primary={item.title}
                    secondary={item.subtitle}
                    primaryTypographyProps={{ fontWeight: 700, fontSize: "0.92rem" }}
                    secondaryTypographyProps={{ fontSize: "0.7rem", color: "rgba(255,255,255,.42)" }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mx: collapsed ? 1.5 : 3 }} />

      {/* Footer */}
      {/* <Box sx={{ p: collapsed ? 1.25 : 2 }}>
        <ListItemButton
          sx={{ borderRadius: "10px", py: 1, px: collapsed ? 1.5 : 1.75, color: "rgba(255,255,255,.6)" }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 40, justifyContent: collapsed ? "center" : "flex-start" }}>
            <SettingsRounded fontSize="small" />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Settings" primaryTypographyProps={{ fontWeight: 600, fontSize: "0.85rem" }} />}
        </ListItemButton>

        <ListItemButton
          sx={{ borderRadius: "10px", py: 1, px: collapsed ? 1.5 : 1.75, color: "rgba(255,255,255,.6)" }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 40, justifyContent: collapsed ? "center" : "flex-start" }}>
            <SupportAgentRounded fontSize="small" />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Help & Support" primaryTypographyProps={{ fontWeight: 600, fontSize: "0.85rem" }} />}
        </ListItemButton>

        <ListItemButton
          sx={{ borderRadius: "10px", py: 1, px: collapsed ? 1.5 : 1.75, color: "rgba(255,255,255,.6)" }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 40, justifyContent: collapsed ? "center" : "flex-start" }}>
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Sign out" primaryTypographyProps={{ fontWeight: 600, fontSize: "0.85rem" }} />}
        </ListItemButton>
      </Box> */}
    </Box>
  );
};

export default DashboardSidebar;
