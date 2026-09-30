import Link from "next/link";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warning";
type Size = "sm" | "md" | "lg";

export type ButtonVariant = Variant;
export type ButtonSize = Size;

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-contrast hover:brightness-110 active:brightness-95 shadow-card disabled:opacity-50",
  secondary: "bg-surface text-text border border-border hover:bg-muted disabled:opacity-50",
  ghost: "bg-transparent text-text hover:bg-muted disabled:opacity-50",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95 disabled:opacity-50",
  warning: "bg-warning text-white hover:brightness-110 active:brightness-95 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  // Every size clears the 44 x 44 px touch target (NFR: accessibility).
  sm: "min-h-touch px-4 py-2 text-small",
  md: "min-h-touch px-5 py-2.5 text-body",
  lg: "min-h-touch px-6 py-3 text-body",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-[background-color,filter,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed select-none";

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", className, children, icon, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass({ variant, size, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant = "primary", size = "md", className, children, icon, href, ...rest }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
