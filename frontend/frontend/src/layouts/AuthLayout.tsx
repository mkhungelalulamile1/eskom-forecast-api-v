import {
  Box,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import Grid from "@mui/material/Grid";

import { Outlet } from "react-router-dom";

import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";

const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#EEF3F8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 4,
      }}
    >
      <Container maxWidth="xl">
        <Paper
          elevation={0}
          sx={{
            overflow: "hidden",
            borderRadius: 8,
            minHeight: "86vh",
            boxShadow: "0 30px 80px rgba(15,23,42,.12)",
          }}
        >
          <Grid container sx={{ minHeight: "86vh" }}>
            {/* LEFT PANEL */}
            <Grid item xs={12} lg={7}>
              <Box
                sx={{
                  position: "relative",
                  height: "100%",
                  color: "#fff",
                  overflow: "hidden",
                  background:
                    "linear-gradient(180deg,#0E63F4 0%,#0A56D6 100%)",
                  display: {
                    xs: "none",
                    lg: "flex",
                  },
                  flexDirection: "column",
                  justifyContent: "space-between",
                  p: 8,
                }}
              >
                {/* Grid background */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.12,
                    backgroundImage: `
                      linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)
                    `,
                    backgroundSize: "40px 40px",
                  }}
                />

                {/* Decorative circles */}
                <Box
                  sx={{
                    position: "absolute",
                    width: 420,
                    height: 420,
                    borderRadius: "50%",
                    bgcolor: "rgba(255,255,255,.06)",
                    right: -120,
                    top: -120,
                  }}
                />

                <Box
                  sx={{
                    position: "absolute",
                    width: 320,
                    height: 320,
                    borderRadius: "50%",
                    bgcolor: "rgba(255,255,255,.05)",
                    left: -80,
                    bottom: -100,
                  }}
                />

                <Box sx={{ position: "relative", zIndex: 2 }}>
                  <Typography
                    variant="h3"
                    fontWeight={800}
                    sx={{
                      letterSpacing: 1,
                    }}
                  >
                    ESKOM
                  </Typography>

                  <Typography
                    sx={{
                      mt: 1,
                      opacity: 0.9,
                      fontSize: 18,
                    }}
                  >
                    Forecast Management Platform
                  </Typography>
                </Box>

                <Box
                  sx={{
                    position: "relative",
                    zIndex: 2,
                    maxWidth: 540,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 48,
                      lineHeight: 1.15,
                      fontWeight: 700,
                      mb: 3,
                    }}
                  >
                    Smarter forecasting.
                    <br />
                    Better operational decisions.
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: 18,
                      opacity: 0.9,
                      lineHeight: 1.8,
                    }}
                  >
                    Monitor demand forecasts, generation trends,
                    model performance and power station availability
                    from one enterprise platform.
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={6}
                    sx={{ mt: 8 }}
                  >
                    <Stack spacing={1} alignItems="center">
                      <BoltRoundedIcon fontSize="large" />
                      <Typography fontWeight={700}>
                        Real-Time
                      </Typography>
                    </Stack>

                    <Stack spacing={1} alignItems="center">
                      <InsightsRoundedIcon fontSize="large" />
                      <Typography fontWeight={700}>
                        Analytics
                      </Typography>
                    </Stack>

                    <Stack spacing={1} alignItems="center">
                      <ShieldRoundedIcon fontSize="large" />
                      <Typography fontWeight={700}>
                        Secure
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              </Box>
            </Grid>

            {/* RIGHT PANEL */}
            <Grid item xs={12} lg={5}>
              <Box
                sx={{
                  bgcolor: "#F8FAFD",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  p: {
                    xs: 3,
                    md: 6,
                  },
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    width: "100%",
                    maxWidth: 500,
                    borderRadius: 6,
                    bgcolor: "#fff",
                    p: {
                      xs: 4,
                      md: 6,
                    },
                    boxShadow:
                      "0 20px 60px rgba(15,23,42,.08)",
                  }}
                >
                  <Outlet />
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default AuthLayout;