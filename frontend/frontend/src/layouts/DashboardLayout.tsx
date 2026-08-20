import { useState } from "react";

import {
  Box,
  Container,
} from "@mui/material";

import {
  Outlet,
  useLocation,
} from "react-router-dom";

import DashboardHeader from "../components/layout/DashboardHeader";
import DashboardSidebar from "../components/layout/DashboardSidebar";


/**
 * =====================================================
 * PAGE TITLES
 * =====================================================
 */

const pageTitles: Record<
  string,
  {
    title: string;
    subtitle: string;
  }
> = {
  "/forecast": {
    title: "Coal Forecasting",
    subtitle:
      "Tactical daily and strategic monthly predictions for coal burn, supply and stockpile across Eskom power stations.",
  },

  "/model-performance": {
    title: "Model Performance",
    subtitle:
      "Evaluate forecast accuracy, error profiles and out-of-time performance for the selected horizon and station.",
  },

  // "/inference-monitoring": {
  //   title: "Inference Monitoring",
  //   subtitle:
  //     "Operational visibility into forecasting pipeline executions, resource interactions and external service health.",
  // },
};


/**
 * =====================================================
 * DASHBOARD LAYOUT
 * =====================================================
 *
 * Layout structure:
 *
 * ┌──────────────────────────────────────────────┐
 * │ Sidebar │ Dashboard Header                   │
 * │         ├────────────────────────────────────┤
 * │         │                                    │
 * │         │ Scrollable Main                    │
 * │         │                                    │
 * │         │ Forecast Context ← sticky          │
 * │         │                                    │
 * │         │ Dashboard Content                  │
 * │         │                                    │
 * └─────────┴────────────────────────────────────┘
 *
 * IMPORTANT:
 *
 * The main content is the scrolling container.
 *
 * Therefore sticky children inside <main>
 * can correctly use:
 *
 *     position: sticky
 *     top: 0
 *
 * without being affected by the page itself.
 */

const DashboardLayout = () => {
  const location = useLocation();

  const [
    collapsed,
    setCollapsed,
  ] = useState(false);


  const page =
    pageTitles[
      location.pathname
    ] ?? {
      title:
        "Forecast Management",

      subtitle:
        "",
    };


  return (
    <Box
      sx={{
        display: "flex",

        /*
         * IMPORTANT
         *
         * Use a fixed viewport height here.
         * This allows <main> below to become
         * the actual scrolling container.
         */
        height: "100vh",

        width: "100%",

        overflow: "hidden",

        bgcolor:
          "background.default",
      }}
    >

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <DashboardSidebar
        collapsed={collapsed}
        onToggle={() =>
          setCollapsed(
            (value) =>
              !value
          )
        }
      />


      {/* ==================================================
          RIGHT SIDE
      ================================================== */}

      <Box
        sx={{
          flex: 1,

          minWidth: 0,

          /*
           * Required for the child <main>
           * to correctly shrink inside flex.
           */
          minHeight: 0,

          display: "flex",

          flexDirection:
            "column",
        }}
      >


        {/* ==================================================
            SCROLLING MAIN CONTENT
        ================================================== */}

        <Box
          component="main"
          className="eskom-scroll-container"
          sx={{
            flex: 1,

            /*
             * CRITICAL:
             *
             * Without this, the flex child can
             * grow beyond the viewport and the
             * sticky context bar will not behave
             * as expected.
             */
            minHeight: 0,

            minWidth: 0,

            /*
             * THIS is the scrolling container.
             */
            overflowY: "auto",

            overflowX: "hidden",

            /*
             * Smooth scrolling is optional,
             * but gives the dashboard a better feel.
             */
            WebkitOverflowScrolling:
              "touch",

            /*
             * Prevent horizontal content
             * from creating another scrollbar.
             */
            width: "100%",

            /*
             * Always reserve the scrollbar gutter and disable scroll
             * anchoring. Panels that resize while scrolling (the sticky
             * Forecast Context bar) used to add/remove the scrollbar and
             * re-anchor the scroll position, which read as flickering.
             */
            scrollbarGutter: "stable",
            overflowAnchor: "none",
          }}
        >

          <Container
            maxWidth={false}
            disableGutters
            sx={{
              width: "100%",

              minWidth: 0,

              px: {
                xs: 2,
                sm: 3,
                md: 4,
              },

              py: {
                xs: 2,
                md: 3,
              },

              /*
               * IMPORTANT:
               *
               * Don't put overflow:hidden here.
               * It would create another overflow
               * context and can interfere with sticky.
               */
              overflow: "visible",
            }}
          >

            <Outlet />

          </Container>

        </Box>

      </Box>

    </Box>
  );
};


export default DashboardLayout;