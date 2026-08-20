import {
  Box,
  BoxProps,
} from "@mui/material";

import SectionHeader from "./SectionHeader";

interface PageSectionProps extends BoxProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const PageSection = ({
  title,
  subtitle,
  action,
  children,
  sx,
  ...props
}: PageSectionProps) => {
  return (
    <Box
      {...props}
      sx={sx}
    >
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={action}
      />

      {children}
    </Box>
  );
};

export default PageSection;