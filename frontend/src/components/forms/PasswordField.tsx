import { useState } from "react";

import {
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";

import LockRoundedIcon from "@mui/icons-material/LockRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
}

const PasswordField = ({
  value,
  onChange,
}: PasswordFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <TextField
      fullWidth
      label="Password"
      placeholder="Enter your password"
      type={showPassword ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      variant="outlined"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <LockRoundedIcon
              color="action"
              fontSize="small"
            />
          </InputAdornment>
        ),

        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              edge="end"
              onClick={() =>
                setShowPassword((prev) => !prev)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <VisibilityOffRoundedIcon />
              ) : (
                <VisibilityRoundedIcon />
              )}
            </IconButton>
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
            borderColor: "#0D63F4",
            borderWidth: 2,
          },
        },
      }}
    />
  );
};

export default PasswordField;