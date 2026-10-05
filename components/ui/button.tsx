import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--navy)] hover:text-white",
  secondary:
    "bg-white text-[var(--fg)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--surface)]",
  ghost: "bg-transparent text-[var(--fg)] hover:bg-[var(--surface)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] px-3 py-2 text-base font-semibold transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
});
