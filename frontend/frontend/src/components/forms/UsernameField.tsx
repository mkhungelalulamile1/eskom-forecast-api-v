import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import {
  InputAdornment,
  TextField,
} from "@mui/material";

interface UsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

const UsernameField = ({
  value,
  onChange,
}: UsernameFieldProps) => {
  return (
    <TextField
      fullWidth
      label="Username"
      placeholder="Enter your username"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      variant="outlined"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <PersonOutlineRoundedIcon
              color="action"
              fontSize="small"
            />
          </InputAdornment>
        ),
        sx: {
          height: 58,
          borderRadius: 3,
          bgcolor: "#FAFBFC",

          "& fieldset": {
            borderColor: "#D9E2EC",
          },

          "&:hover fieldset": {
            borderColor: "#0D63F4",
          },

          "&.Mui-focused fieldset": {
            borderWidth: 2,
            borderColor: "#0D63F4",
          },
        },
      }}
    />
  );
};

export default UsernameField;