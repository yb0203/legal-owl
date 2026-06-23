import { cn } from "@/lib/utils";

// The native <select> control, styled to match Input. Pages use a real <select>
// (not the shadcn Select) so it works inside Server-Action forms without client
// JS; this primitive replaces the `selectCls` string copy-pasted across forms.
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
