import { createTheme, Theme } from "@mui/material/styles";

import { getPalette, ThemeMode } from "./palette";
import typography from "./typography";
import { getComponents } from "./components";

/**
 * =====================================================
 * THEME FACTORY
 * =====================================================
 * Creates a full MUI theme for a given colour mode (light/dark).
 * Used by ThemeModeContext to re-theme the whole app on toggle.
 */
export const createAppTheme = (mode: ThemeMode): Theme =>
  createTheme({
    shape: {
      // Global default radius — 12px for all cards
      borderRadius: 12,
    },
    palette: getPalette(mode),
    typography,
    components: getComponents(mode),
  });

const theme = createAppTheme("light");

export default theme;
