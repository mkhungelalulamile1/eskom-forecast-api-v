import { ReactNode } from "react";

import { Avatar } from "@mui/material";
import { alpha, Theme, useTheme } from "@mui/material/styles";

type PaletteColor =
  | keyof Pick<
      Theme["palette"],
      "primary" | "secondary" | "success" | "warning" | "error" | "info"
    >;

interface IconContainerProps {
  color?: PaletteColor;
  children: ReactNode;
  size?: number;
}

const IconContainer = ({
  color = "primary",
  children,
  size = 54,
}: IconContainerProps) => {
  const theme = useTheme();

  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: alpha(theme.palette[color].main, 0.12),
        color: theme.palette[color].main,
      }}
    >
      {children}
    </Avatar>
  );
};

export default IconContainer;