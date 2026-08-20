import React from "react";
import { Card, CardProps } from "@mui/material";

interface AppCardProps extends CardProps {
  children: React.ReactNode;
}

const AppCard = ({
  children,
  sx,
  ...props
}: AppCardProps) => {
  return (
    <Card
      elevation={0}
      sx={{
        display: "flex",
        flexDirection: "column",

        borderRadius: "12px !important",
        overflow: "hidden !important",

        border: "1px solid",
        borderColor: "divider",

        bgcolor: "background.paper",

        p: {
          xs: 2,
          sm: 3,
        },

        boxShadow: "0px 10px 35px rgba(15, 23, 42, 0.06)",

        transition: "box-shadow .25s ease",

        "&:hover": {
          boxShadow: "0px 14px 42px rgba(15, 23, 42, 0.08)",
        },

        ...sx,
      }}
      {...props}
    >
      {children}
    </Card>
  );
};

export default AppCard;