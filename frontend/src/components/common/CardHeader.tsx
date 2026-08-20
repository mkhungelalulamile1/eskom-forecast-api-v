import React from "react";
import { Box, Stack, Typography } from "@mui/material";

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const CardHeader = ({
  title,
  subtitle,
  action,
}: CardHeaderProps) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 2,
        mb: 3,
      }}
    >
      <Stack
        spacing={0.5}
        sx={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: "text.primary",
            lineHeight: 1.25,
            wordBreak: "break-word",
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              lineHeight: 1.6,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Stack>

      {action && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {action}
        </Box>
      )}
    </Box>
  );
};

export default CardHeader;