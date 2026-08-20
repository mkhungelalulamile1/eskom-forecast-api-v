import {
  AssessmentRounded,
  MonitorHeartRounded,
  InsightsRounded,
} from "@mui/icons-material";

import { ROUTES } from "../routes/routes";

/**
 * =====================================================
 * APPLICATION NAVIGATION
 * =====================================================
 * Redesigned navigation model — adds an icon + short description
 * for each route so the new sidebar can render grouped, annotated
 * navigation items.
 */
export const navigation = [
  {
    title: "Forecast",
    subtitle:
      "Tactical daily & strategic monthly forecasts",
    icon: InsightsRounded,
    path: ROUTES.FORECAST,
  },

  {
    title: "Model Performance",
    subtitle:
      "Accuracy, error & out-of-time performance",
    icon: AssessmentRounded,
    path: ROUTES.MODEL_PERFORMANCE,
  },

  // {
  //   title: "Inference Monitoring",
  //   subtitle:
  //     "Pipeline health, latency & resource activity",
  //   icon: MonitorHeartRounded,
  //   path: ROUTES.INFERENCE_MONITORING,
  // },
];
