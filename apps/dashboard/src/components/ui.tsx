import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared input styling: dedicated input surface, soft line border, quiet focus.
const fieldClass =
  "w-full rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-brand focus:shadow-[0_0_0_3px_rgba(59,130,246,0.18)] disabled:cursor-not-allowed disabled:opacity-50";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Solid surface + soft, theme-aware shadow; a light, quiet border.
        "rounded-3xl border border-[rgb(var(--line))] bg-neutral-900 p-7 shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldClass, className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(fieldClass, className)} {...props} />
  );
});

// Hide the native arrow and overlay our own chevron so we control its spacing
// from the right edge. Any width class from the caller sizes the wrapper.
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        className={cn(fieldClass, "w-full appearance-none pr-10")}
        {...props}
      />
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
      />
    </div>
  );
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-brand text-brand-fg shadow-soft hover:bg-[#39aee8]",
    // Success maps to the primary blue — the design system forbids green.
    success: "bg-brand text-brand-fg shadow-soft hover:bg-[#39aee8]",
    secondary:
      "border border-[rgba(32,158,219,0.30)] bg-transparent text-neutral-100 hover:bg-neutral-800",
    danger:
      "border border-[rgba(224,92,92,0.28)] bg-transparent text-[#E56D6D] hover:bg-[rgba(229,109,109,0.10)]",
    ghost: "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100",
  };
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-2 block text-[13px] font-medium text-neutral-300",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xl px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}
