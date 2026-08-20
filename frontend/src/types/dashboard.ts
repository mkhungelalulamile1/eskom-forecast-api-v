import { SvgIconComponent } from "@mui/icons-material";

export type StatCardColor =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info";

export interface DashboardKPI {
  title: string;
  value: string | number;
  trend: string;
  color: StatCardColor;
  icon: SvgIconComponent;
}