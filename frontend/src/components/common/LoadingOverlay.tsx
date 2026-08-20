import {
  Box,
  CircularProgress,
} from "@mui/material";

const LoadingOverlay = () => {
  return (
    <Box
      sx={{
        minHeight: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress />
    </Box>
  );
};

export default LoadingOverlay;