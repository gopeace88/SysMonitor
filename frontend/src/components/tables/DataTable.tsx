"use client";

import { useState, useMemo } from "react";

interface Column {
  key: string;
  label: string;
  format?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  title?: string;
  maxHeight?: string;
}

export default function DataTable({
  columns,
  data,
  title,
  maxHeight = "300px",
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const getSortIndicator = (key: string) => {
    if (sortKey !== key) return " \u2195";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  return (
    <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg overflow-hidden">
      {title && (
        <div className="px-3 py-2 border-b border-[#2d3a4f]">
          <h3 className="text-xs font-semibold text-sm-text">{title}</h3>
        </div>
      )}
      <div
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#16213e]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2 text-sm-text-dim font-medium cursor-pointer hover:text-sm-text transition-colors select-none whitespace-nowrap ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                  <span className="text-sm-text-dim/50">
                    {getSortIndicator(col.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-sm-text-dim"
                >
                  No data available
                </td>
              </tr>
            ) : (
              sortedData.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-[#2d3a4f]/50 hover:bg-sm-surface-hover transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-1.5 ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {col.format
                        ? col.format(row[col.key], row)
                        : (row[col.key] as React.ReactNode) ?? "-"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
