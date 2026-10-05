import { forwardRef, type SelectHTMLAttributes } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={`rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--sky)] ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  },
);
