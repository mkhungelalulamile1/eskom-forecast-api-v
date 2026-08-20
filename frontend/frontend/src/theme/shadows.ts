import { Shadows } from "@mui/material/styles";

const shadows: Shadows = [
  "none",
  "0px 2px 8px rgba(15,23,42,0.05)",
  "0px 4px 12px rgba(15,23,42,0.06)",
  "0px 8px 24px rgba(15,23,42,0.08)",
  "0px 12px 32px rgba(15,23,42,0.10)",
  ...Array(20).fill("0px 12px 32px rgba(15,23,42,0.10)"),
] as Shadows;

export default shadows;