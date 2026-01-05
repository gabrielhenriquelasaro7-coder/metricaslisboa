import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand={true}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-xl group-[.toaster]:shadow-primary/5",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:shadow-lg group-[.toast]:shadow-primary/20",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-metric-positive group-[.toaster]:bg-metric-positive/5",
          error: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-metric-negative group-[.toaster]:bg-metric-negative/5",
          warning: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-metric-warning group-[.toaster]:bg-metric-warning/5",
          info: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-primary group-[.toaster]:bg-primary/5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
