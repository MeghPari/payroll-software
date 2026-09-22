"use client";

import { type ReactNode, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { TableRowsSkeleton } from "@/components/shared/loading-skeleton";
import { cn } from "@/lib/utils";

export interface CellContext<T> {
  row: { original: T };
  getValue: <V = unknown>() => V;
}

export interface Column<T> {
  id?: string;
  header: string;
  accessorKey?: keyof T;
  accessorFn?: (row: T) => unknown;
  enableSorting?: boolean;
  cell?: (ctx: CellContext<T>) => ReactNode;
  className?: string;
}

function getColumnId<T>(col: Column<T>, index: number): string {
  return col.id ?? (col.accessorKey ? String(col.accessorKey) : `col-${index}`);
}

function getRawValue<T>(col: Column<T>, row: T): unknown {
  if (col.accessorFn) return col.accessorFn(row);
  if (col.accessorKey) return row[col.accessorKey];
  return undefined;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  stickyHeader?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  loading,
  pageSize = 10,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filters.",
  stickyHeader = true,
}: DataTableProps<T>) {
  const [sortId, setSortId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageIndex, setPageIndex] = useState(0);

  const sortedData = useMemo(() => {
    if (!sortId) return data;
    const col = columns.find((c, i) => getColumnId(c, i) === sortId);
    if (!col) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const av = getRawValue(col, a);
      const bv = getRawValue(col, b);
      if (av == null && bv == null) return 0;
      if (av == null) return -1;
      if (bv == null) return 1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sortDir === "desc") copy.reverse();
    return copy;
  }, [data, sortId, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageRows = sortedData.slice(currentPageIndex * pageSize, currentPageIndex * pageSize + pageSize);

  function toggleSort(colId: string) {
    if (sortId !== colId) {
      setSortId(colId);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortId(null);
    }
  }

  if (loading) {
    return <TableRowsSkeleton rows={6} columns={columns.length} />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-muted/50")}>
            <TableRow className="hover:bg-transparent">
              {columns.map((col, index) => {
                const colId = getColumnId(col, index);
                const canSort = col.enableSorting !== false && (!!col.accessorKey || !!col.accessorFn);
                const isSorted = sortId === colId;
                return (
                  <TableHead
                    key={colId}
                    className={cn("whitespace-nowrap text-xs font-semibold text-muted-foreground", canSort && "cursor-pointer select-none", col.className)}
                    onClick={canSort ? () => toggleSort(colId) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {canSort &&
                        (isSorted ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        ))}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className={cn(onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(row)}>
                {columns.map((col, index) => {
                  const colId = getColumnId(col, index);
                  const value = getRawValue(col, row);
                  return (
                    <TableCell key={colId} className={cn("text-sm", col.className)}>
                      {col.cell ? col.cell({ row: { original: row }, getValue: <V,>() => value as V }) : (value as ReactNode) ?? "—"}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border px-4 py-3">
        {totalPages > 1 ? (
          <Pagination
            page={currentPageIndex + 1}
            totalPages={totalPages}
            onPageChange={(p) => setPageIndex(p - 1)}
            totalItems={data.length}
            pageSize={pageSize}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Showing {data.length} of {data.length} entries
          </p>
        )}
      </div>
    </div>
  );
}
