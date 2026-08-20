import React, { useState } from "react";
import {
    Box,
    Button,
    Popover,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Divider,
    SelectChangeEvent,
} from "@mui/material";
import {
    FilterListRounded,
    CheckRounded,
} from "@mui/icons-material";

export interface FilterOption {
    label: string;
    value: string;
}

export interface CardFilterConfig {
    horizon?: {
        value: string;
        onChange: (value: any) => void;
        options: FilterOption[];
    };
    metric?: {
        value: string;
        onChange: (value: any) => void;
        options: FilterOption[];
    };
    station?: {
        value: string;
        onChange: (value: any) => void;
        options: FilterOption[];
    };
    scenario?: {
        value: string;
        onChange: (value: any) => void;
        options: FilterOption[];
    };
}

interface CardFilterDropdownProps {
    filters: CardFilterConfig;
    buttonSize?: "small" | "medium" | "large";
}

const CardFilterDropdown: React.FC<CardFilterDropdownProps> = ({
    filters,
    buttonSize = "small",
}) => {
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? "card-filter-popover" : undefined;

    const activeFiltersCount = [
        filters.horizon?.value,
        filters.metric?.value,
        filters.station?.value,
        filters.scenario?.value,
    ].filter(Boolean).length;

    return (
        <>
            <Button
                aria-describedby={id}
                variant="outlined"
                size={buttonSize}
                startIcon={<FilterListRounded />}
                onClick={handleClick}
                sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    borderRadius: "8px",
                    minWidth: 100,
                }}
            >
                Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>

            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                PaperProps={{
                    sx: {
                        mt: 1,
                        minWidth: 320,
                        maxWidth: 400,
                        borderRadius: "12px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    },
                }}
            >
                <Box sx={{ p: 2.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                        <FilterListRounded fontSize="small" color="primary" />
                        <Typography variant="h6" fontWeight={700}>
                            Card Filters
                        </Typography>
                    </Stack>

                    <Typography variant="body2" color="text.secondary" mb={2.5}>
                        Customize the data displayed in this card
                    </Typography>

                    <Stack spacing={2.5}>
                        {/* Horizon Filter */}
                        {filters.horizon && (
                            <FormControl fullWidth size="small">
                                <InputLabel>Horizon</InputLabel>
                                <Select
                                    value={filters.horizon.value}
                                    label="Horizon"
                                    onChange={(e: SelectChangeEvent) =>
                                        filters.horizon?.onChange(e.target.value)
                                    }
                                    sx={{ borderRadius: "8px" }}
                                >
                                    {filters.horizon.options.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            <Stack
                                                direction="row"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                width="100%"
                                            >
                                                <span>{option.label}</span>
                                                {filters.horizon?.value === option.value && (
                                                    <CheckRounded fontSize="small" color="primary" />
                                                )}
                                            </Stack>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {/* Metric Filter */}
                        {filters.metric && (
                            <FormControl fullWidth size="small">
                                <InputLabel>Metric</InputLabel>
                                <Select
                                    value={filters.metric.value}
                                    label="Metric"
                                    onChange={(e: SelectChangeEvent) =>
                                        filters.metric?.onChange(e.target.value)
                                    }
                                    sx={{ borderRadius: "8px" }}
                                >
                                    {filters.metric.options.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            <Stack
                                                direction="row"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                width="100%"
                                            >
                                                <span>{option.label}</span>
                                                {filters.metric?.value === option.value && (
                                                    <CheckRounded fontSize="small" color="primary" />
                                                )}
                                            </Stack>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {/* Power Station Filter */}
                        {filters.station && (
                            <FormControl fullWidth size="small">
                                <InputLabel>Power Station</InputLabel>
                                <Select
                                    value={filters.station.value}
                                    label="Power Station"
                                    onChange={(e: SelectChangeEvent) =>
                                        filters.station?.onChange(e.target.value)
                                    }
                                    sx={{ borderRadius: "8px" }}
                                >
                                    {filters.station.options.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            <Stack
                                                direction="row"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                width="100%"
                                            >
                                                <span>{option.label}</span>
                                                {filters.station?.value === option.value && (
                                                    <CheckRounded fontSize="small" color="primary" />
                                                )}
                                            </Stack>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {/* Scenario Filter */}
                        {filters.scenario && (
                            <FormControl fullWidth size="small">
                                <InputLabel>Scenario</InputLabel>
                                <Select
                                    value={filters.scenario.value}
                                    label="Scenario"
                                    onChange={(e: SelectChangeEvent) =>
                                        filters.scenario?.onChange(e.target.value)
                                    }
                                    sx={{ borderRadius: "8px" }}
                                >
                                    {filters.scenario.options.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            <Stack
                                                direction="row"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                width="100%"
                                            >
                                                <span>{option.label}</span>
                                                {filters.scenario?.value === option.value && (
                                                    <CheckRounded fontSize="small" color="primary" />
                                                )}
                                            </Stack>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                            size="small"
                            onClick={handleClose}
                            sx={{
                                textTransform: "none",
                                fontWeight: 600,
                                borderRadius: "8px",
                            }}
                        >
                            Close
                        </Button>
                    </Stack>
                </Box>
            </Popover>
        </>
    );
};

export default CardFilterDropdown;
