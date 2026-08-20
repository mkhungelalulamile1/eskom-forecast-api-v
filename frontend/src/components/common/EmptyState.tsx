import { Box, Typography } from "@mui/material";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

const EmptyState = ({
  title = "No data available",
  description = "There is nothing to display.",
}: EmptyStateProps) => {
  return (
    <Box
      sx={{
        py: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <InboxRoundedIcon
        sx={{
          fontSize: 48,
          color: "text.disabled",
          mb: 2,
        }}
      />

      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
      >
        {description}
      </Typography>
    </Box>
  );
};

export default EmptyState;