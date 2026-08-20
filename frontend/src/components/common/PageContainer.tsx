import {
  Box,
  BoxProps,
} from "@mui/material";

interface PageContainerProps extends BoxProps {
  children: React.ReactNode;
}

const PageContainer = ({
  children,
  sx,
  ...props
}: PageContainerProps) => {
  return (
    <Box
      {...props}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default PageContainer;