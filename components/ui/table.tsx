import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={`w-full border-collapse text-left text-sm text-[var(--fg)] ${className}`}
      {...props}
    />
  );
}

export function TableHead({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 font-semibold text-[var(--navy-soft)] ${className}`}
      {...props}
    />
  );
}

export function TableCell({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`border-b border-[var(--border)] px-4 py-3 ${className}`} {...props} />
  );
}
