import { useId, type ReactNode } from 'react';

export interface ResponsiveTableColumn<T> {
  key: string;
  header: string;
  isRowHeader?: boolean;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export interface ResponsiveTableProps<T> {
  caption: string;
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
}

export function ResponsiveTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No records available.',
}: ResponsiveTableProps<T>) {
  const captionId = useId();

  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby={captionId}
      className="table-wrapper"
    >
      <table className="responsive-table text-sm">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={col.align === 'right' ? 'text-end' : 'text-start'}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-[var(--pb-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((col, idx) => {
                  const isRowHeader = col.isRowHeader ?? idx === 0;
                  if (isRowHeader) {
                    return (
                      <th
                        key={col.key}
                        scope="row"
                        className={col.align === 'right' ? 'text-end' : 'text-start'}
                      >
                        {col.render(row)}
                      </th>
                    );
                  }
                  return (
                    <td
                      key={col.key}
                      data-label={col.header}
                      className={col.align === 'right' ? 'text-end tabular-nums' : 'text-start'}
                    >
                      {col.render(row)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
