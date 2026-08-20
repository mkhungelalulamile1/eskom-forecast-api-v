import React from "react";

import {
  Avatar,
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import {
  alpha,
  useTheme,
} from "@mui/material/styles";

import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";

import AppCard from "./AppCard";

export interface StatCardProps {
  title: string;

  value: string | number;

  unit?: string;

  subtitle?: string;

  trend?: string;

  icon: React.ReactNode;

  color?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "error"
    | "info";
}

const StatCard = ({
  title,
  value,
  unit,
  subtitle,
  trend,
  icon,
  color = "primary",
}: StatCardProps) => {
  const theme = useTheme();

  const palette = theme.palette[color];

  const negative =
    trend?.trim().startsWith("-") ?? false;

  return (
    <AppCard
      sx={{
        height: "100%",
        minHeight: 195,
        transition: ".25s",

        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow:
            "0 18px 45px rgba(15,23,42,.08)",
        },
      }}
    >
      <Stack
        justifyContent="space-between"
        sx={{
          height: "100%",
        }}
      >
        {/* TOP */}

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box flex={1} pr={2}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: "text.secondary",
                letterSpacing: 1.3,
                textTransform: "uppercase",
              }}
            >
              {title}
            </Typography>

            {subtitle && (
              <Typography
                sx={{
                  mt: .75,
                  color: "text.secondary",
                  fontSize: 13,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          <Avatar
            sx={{
              width: 54,
              height: 54,
              bgcolor: alpha(
                palette.main,
                .12
              ),
              color: palette.main,
            }}
          >
            {icon}
          </Avatar>
        </Box>

        {/* VALUE */}

        <Box mt={5}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-end"
          >
            <Typography
              sx={{
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1,
                color: "text.primary",
              }}
            >
              {value}
            </Typography>

            {unit && (
              <Typography
                sx={{
                  mb: .5,
                  fontWeight: 600,
                  color: "text.secondary",
                }}
              >
                {unit}
              </Typography>
            )}
          </Stack>

          {trend && (
            <Chip
              size="small"
              sx={{
                mt: 2,
                bgcolor: negative
                  ? alpha(
                      theme.palette.error.main,
                      .12
                    )
                  : alpha(
                      theme.palette.success.main,
                      .12
                    ),

                color: negative
                  ? "error.main"
                  : "success.main",

                fontWeight: 700,

                borderRadius: 2,
              }}
              icon={
                negative ? (
                  <TrendingDownRoundedIcon />
                ) : (
                  <TrendingUpRoundedIcon />
                )
              }
              label={trend}
            />
          )}
        </Box>
      </Stack>
    </AppCard>
  );
};

export default StatCard;