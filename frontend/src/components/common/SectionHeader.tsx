import {
  Box,
  Typography,
} from "@mui/material";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const SectionHeader = ({
  title,
  subtitle,
  action,
}: SectionHeaderProps) => {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      mb={3}
    >
      <Box>
        <Typography
          variant="h6"
          fontWeight={700}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            variant="body2"
            color="text.secondary"
            mt={0.5}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      {action}
    </Box>
  );
};

export default SectionHeader;