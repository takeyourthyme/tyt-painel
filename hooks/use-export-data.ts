"use client";

import { useCallback } from "react";

export type ExportColumn<T> = {
    header: string;
    key: keyof T | ((item: T) => string | number | null | undefined);
};

export function useExportData<T>() {
    const exportToCsv = useCallback((data: T[], columns: ExportColumn<T>[], filename: string) => {
        const escapeCell = (val: any): string => {
            if (val === null || val === undefined) return "";
            const str = String(val);
            // Escape double quotes by doubling them, wrap in double quotes
            return `"${str.replace(/"/g, '""')}"`;
        };

        const bom = "\uFEFF";
        const csvContent = bom + [
            columns.map(col => escapeCell(col.header)).join(";"),
            ...data.map(row => columns.map(col => {
                const value = typeof col.key === "function" ? col.key(row) : row[col.key];
                return escapeCell(value);
            }).join(";"))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    return { exportToCsv };
}
