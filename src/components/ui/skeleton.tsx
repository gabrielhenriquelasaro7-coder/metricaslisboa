import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "rounded-lg bg-gradient-to-r from-muted/40 via-muted/60 to-muted/40 relative overflow-hidden",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_2s_ease-in-out_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-primary/5 before:to-transparent",
        className
      )} 
      {...props}
    />
  );
}

export { Skeleton };