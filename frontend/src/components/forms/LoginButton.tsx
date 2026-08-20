import { Button, CircularProgress } from "@mui/material";

interface LoginButtonProps {
  loading: boolean;
}

const LoginButton = ({
  loading,
}: LoginButtonProps) => {
  return (
    <Button
      type="submit"
      fullWidth
      variant="contained"
      disabled={loading}
      sx={{
        height: 56,
        borderRadius: "12px",
        fontSize: 16,
        fontWeight: 700,
        textTransform: "none",
        background:
          "linear-gradient(180deg,#0D63F4 0%,#0A56D6 100%)",
        boxShadow:
          "0 12px 30px rgba(13,99,244,.28)",

        "&:hover": {
          background:
            "linear-gradient(180deg,#0A56D6 0%,#0849B7 100%)",
          boxShadow:
            "0 18px 40px rgba(13,99,244,.35)",
        },
      }}
    >
      {loading ? (
        <CircularProgress
          size={22}
          sx={{ color: "#fff" }}
        />
      ) : (
        "Sign In"
      )}
    </Button>
  );
};

export default LoginButton;