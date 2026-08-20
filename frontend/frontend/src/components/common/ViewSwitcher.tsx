import React from "react";
import {
    ToggleButtonGroup,
    ToggleButton,
    Tooltip,
    Box,
} from "@mui/material";
import {
    ViewListRounded,
    ViewModuleRounded,
    TableChartRounded,
    TimelineRounded,
} from "@mui/icons-material";

export type ViewMode = "list" | "grid" | "table" | "chart";

export interface ViewOption {
    value: ViewMode;
    label: string;
    icon: React.ReactNode;
    tooltip?: string;
}

interface ViewSwitcherProps {
    value: ViewMode;
    onChange: (view: ViewMode) => void;
    options?: ViewOption[];
    size?: "small" | "medium" | "large";
}

const defaultOptions: ViewOption[] = [
    {
        value: "list",
        label: "List",
        icon: <ViewListRounded fontSize="small" />,
        tooltip: "List View",
    },
    {
        value: "grid",
        label: "Grid",
        icon: <ViewModuleRounded fontSize="small" />,
        tooltip: "Grid View",
    },
    {
        value: "table",
        label: "Table",
        icon: <TableChartRounded fontSize="small" />,
        tooltip: "Table View",
    },
    {
        value: "chart",
        label: "Chart",
        icon: <TimelineRounded fontSize="small" />,
        tooltip: "Chart View",
    },
];

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
    value,
    onChange,
    options = defaultOptions,
    size = "small",
}) => {
    const handleChange = (
        _event: React.MouseEvent<HTMLElement>,
        newView: ViewMode | null
    ) => {
        if (newView !== null) {
            onChange(newView);
        }
    };

    return (
        <Box>
            <ToggleButtonGroup
                value={value}
                exclusive
                onChange={handleChange}
                size={size}
                sx={{
                    bgcolor: "background.paper",
                    "& .MuiToggleButton-root": {
                        borderRadius: "8px !important",
                        border: "1px solid",
                        borderColor: "divider",
                        "&.Mui-selected": {
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            "&:hover": {
                                bgcolor: "primary.dark",
                            },
                        },
                    },
                }}
            >
                {options.map((option) => (
                    <Tooltip key={option.value} title={option.tooltip || option.label}>
                        <ToggleButton value={option.value} aria-label={option.label}>
                            {option.icon}
                        </ToggleButton>
                    </Tooltip>
                ))}
            </ToggleButtonGroup>
        </Box>
    );
};

export default ViewSwitcher;
