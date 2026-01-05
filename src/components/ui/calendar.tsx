import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 sm:gap-6",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center h-10",
        caption_label: "text-sm font-semibold text-foreground",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-background/50 p-0 opacity-70 hover:opacity-100 hover:bg-primary/10 transition-all duration-200",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-10 font-medium text-[0.75rem] uppercase tracking-wide",
        row: "flex w-full mt-1",
        cell: cn(
          "relative h-10 w-10 text-center text-sm p-0",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected])]:rounded-md",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-primary/5",
          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal transition-all duration-150",
          "hover:bg-primary/15 hover:text-primary",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground font-medium",
          "hover:bg-primary hover:text-primary-foreground",
          "focus:bg-primary focus:text-primary-foreground",
          "rounded-md shadow-sm"
        ),
        day_today: cn(
          "bg-accent text-accent-foreground font-semibold",
          "ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
        ),
        day_outside: cn(
          "day-outside text-muted-foreground/40",
          "aria-selected:bg-primary/5 aria-selected:text-muted-foreground/60"
        ),
        day_disabled: "text-muted-foreground/30 cursor-not-allowed",
        day_range_middle: cn(
          "aria-selected:bg-primary/15 aria-selected:text-foreground",
          "rounded-none"
        ),
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };