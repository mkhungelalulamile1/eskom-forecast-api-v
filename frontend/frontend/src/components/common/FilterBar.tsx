import React, { useState } from "react";
import {
    Box,
    TextField,
    MenuItem,
    Stack,
    IconButton,
    Tooltip,
    FormControl,
    InputLabel,
    Select,
    SelectChangeEvent,
    InputAdornment,
} from "@mui/material";
import {
    SearchRounded,
    FilterListRounded,
    ClearRounded,
} from "@mui/icons-material";

export interface FilterOption {
    label: string;
    value: string;
}

export interface FilterConfig {
    name: string;
    label: string;
    options: FilterOption[];
    defaultValue?: string;
}

interface FilterBarProps {
    filters?: FilterConfig[];
    onFilterChange?: (filters: Record<string, string>) => void;
    searchPlaceholder?: string;
    onSearchChange?: (search: string) => void;
    showSearch?: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({
    filters = [],
    onFilterChange,
    searchPlaceholder = "Search...",
    onSearchChange,
    showSearch = true,
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        filters.forEach((filter) => {
            initial[filter.name] = filter.defaultValue || "";
        });
        return initial;
    });

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setSearchTerm(value);
        onSearchChange?.(value);
    };

    const handleFilterChange = (name: string) => (event: SelectChangeEvent) => {
        const newFilters = {
            ...filterValues,
            [name]: event.target.value,
        };
        setFilterValues(newFilters);
        onFilterChange?.(newFilters);
    };

    const handleClearFilters = () => {
        const clearedFilters: Record<string, string> = {};
        filters.forEach((filter) => {
            clearedFilters[filter.name] = "";
        });
        setFilterValues(clearedFilters);
        setSearchTerm("");
        onFilterChange?.(clearedFilters);
        onSearchChange?.("");
    };

    const hasActiveFilters = searchTerm || Object.values(filterValues).some((v) => v);

    return (
        <Box
            sx={{
                p: 2,
                borderRadius: "12px !important",
                bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: "1px solid",
                borderColor: "divider",
                mb: 2,
            }}
        >
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", sm: "center" }}
            >
                {/* Search Field */}
                {showSearch && (
                    <TextField
                        size="small"
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={handleSearchChange}
                        sx={{ flex: 1, minWidth: { xs: "100%", sm: 200 } }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchRounded fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                )}

                {/* Filter Dropdowns */}
                {filters.map((filter) => (
                    <FormControl key={filter.name} size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>{filter.label}</InputLabel>
                        <Select
                            value={filterValues[filter.name] || ""}
                            label={filter.label}
                            onChange={handleFilterChange(filter.name)}
                            startAdornment={
                                <InputAdornment position="start">
                                    <FilterListRounded fontSize="small" />
                                </InputAdornment>
                            }
                        >
                            <MenuItem value="">
                                <em>All</em>
                            </MenuItem>
                            {filter.options.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ))}

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                    <Tooltip title="Clear all filters">
                        <IconButton
                            onClick={handleClearFilters}
                            size="small"
                            sx={{
                                bgcolor: "action.hover",
                                "&:hover": {
                                    bgcolor: "action.selected",
                                },
                            }}
                        >
                            <ClearRounded fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
        </Box>
    );
};

export default FilterBar;
