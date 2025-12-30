import React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  OnChangeFn,
} from '@tanstack/react-table';
import { cn } from '../../lib/utils';

/**
 * Props for the DataTable component
 */
export interface DataTableProps<TData, TValue> {
  /** Column definitions for the table */
  columns: ColumnDef<TData, TValue>[];
  /** Data to display in the table */
  data: TData[];
  /** Optional title/header text */
  title?: string;
  /** Optional description text */
  description?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show borders */
  showBorders?: boolean;
  /** Whether to enable sorting */
  enableSorting?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: string | number;
  /** Empty state message */
  emptyMessage?: string;
  /** Whether to show the table header */
  showHeader?: boolean;
}

/**
 * Sort indicator icon
 */
function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (direction === null) {
    return (
      <svg
        className="h-4 w-4 text-muted-foreground/50"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    );
  }

  return (
    <svg
      className="h-4 w-4 text-foreground"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {direction === 'asc' ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 4h13M3 8h9m-9 4h6m4-4l4-4m0 0l4 4m-4-4v12"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 20h13M3 16h9m-9 4h6m4-4l4 4m0-4l4-4m-4 4V4"
        />
      )}
    </svg>
  );
}

/**
 * DataTable Component
 *
 * A flexible table component built on TanStack Table.
 * Features include sorting, borders control, custom styling,
 * and empty state handling.
 *
 * @example
 * ```tsx
 * const columns: ColumnDef<User, string>[] = [
 *   { accessorKey: 'name', header: 'Name' },
 *   { accessorKey: 'email', header: 'Email' },
 * ];
 *
 * <DataTable columns={columns} data={users} title="Users" />
 * ```
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  title,
  description,
  className,
  showBorders = true,
  enableSorting = true,
  maxHeight = '400px',
  emptyMessage = 'No results.',
  showHeader = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting && {
      onSortingChange: setSorting as OnChangeFn<SortingState>,
      getSortedRowModel: getSortedRowModel(),
      state: { sorting },
    }),
  });

  const isEmpty = data.length === 0;

  return (
    <div
      className={cn(
        'rounded-md bg-background',
        showBorders && 'border',
        className
      )}
    >
      {/* Header */}
      {(title || description) && (
        <div className="border-b px-4 py-3">
          {title && <h3 className="font-medium text-foreground">{title}</h3>}
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Table */}
      <div
        className="overflow-auto"
        style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
      >
        <table className="w-full caption-bottom text-sm">
          {/* Table Header */}
          {showHeader && (
            <thead className={cn(showBorders && '[&_tr]:border-b')}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        'h-12 px-4 text-left align-middle font-medium',
                        enableSorting && header.column.getCanSort()
                          ? 'cursor-pointer hover:text-accent-foreground/80 transition-colors'
                          : 'text-muted-foreground',
                        showBorders && 'border-r last:border-r-0'
                      )}
                      onClick={
                        enableSorting && header.column.getToggleSortingHandler()
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {enableSorting && header.column.getCanSort() && (
                        <span className="ml-2 inline-block">
                          <SortIcon direction={header.column.getIsSorted() as 'asc' | 'desc' | null} />
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          )}

          {/* Table Body */}
          <tbody
            className={cn(
              showBorders && '[&_tr]:border-b',
              '[&_tr:last-child]:border-0',
              '[&_tr]:transition-colors',
              '[&_tr]:hover:bg-muted/50'
            )}
          >
            {isEmpty ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows?.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'p-4 align-middle',
                        showBorders && 'border-r last:border-r-0'
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with row count */}
      {!isEmpty && (
        <div className="border-t px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Showing {data.length} {data.length === 1 ? 'row' : 'rows'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Helper type for creating simple column definitions
 */
export type SimpleColumnDef<TData> = {
  accessorKey: keyof TData;
  header: string;
  cell?: (props: { row: { getValue: (key: keyof TData) => unknown } }) => React.ReactNode;
};

/**
 * Convert simple column defs to TanStack Table column defs
 */
export function createSimpleColumns<TData>(defs: SimpleColumnDef<TData>[]): ColumnDef<TData, unknown>[] {
  return defs.map((def) => ({
    accessorKey: def.accessorKey as string,
    header: def.header,
    cell: def.cell
      ? (props) => def.cell!({ row: { getValue: (key) => props.row.getValue(key as string) } })
      : undefined,
  }));
}
