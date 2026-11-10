"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("p-3 [--cell-size:2.1rem]", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col", defaults.months),
        month: cn("flex w-full flex-col gap-3", defaults.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between", defaults.nav),
        button_previous: cn(buttonVariants({ variant: "ghost" }), "size-(--cell-size) p-0 aria-disabled:opacity-40", defaults.button_previous),
        button_next: cn(buttonVariants({ variant: "ghost" }), "size-(--cell-size) p-0 aria-disabled:opacity-40", defaults.button_next),
        month_caption: cn("flex h-(--cell-size) items-center justify-center px-(--cell-size) text-sm font-semibold capitalize", defaults.month_caption),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn("flex-1 text-[0.75rem] font-medium text-muted-foreground uppercase select-none", defaults.weekday),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn("relative aspect-square size-(--cell-size) p-0 text-center text-sm select-none", defaults.day),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) rounded-md p-0 font-normal",
          "group-data-[selected]:bg-primary group-data-[selected]:text-primary-foreground group-data-[selected]:hover:bg-primary/90",
          defaults.day_button
        ),
        today: cn("[&>button]:ring-1 [&>button]:ring-primary/40", defaults.today),
        outside: cn("text-muted-foreground/60", defaults.outside),
        disabled: cn("opacity-40", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClass, ...rest }) => orientation === "left"
          ? <ChevronLeftIcon className={cn("size-4", iconClass)} {...rest} />
          : <ChevronRightIcon className={cn("size-4", iconClass)} {...rest} />,
        Day: ({ day, modifiers, className: dayClass, ...rest }) => (
          <td className={cn("group", dayClass)} data-selected={modifiers.selected || undefined} {...rest} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
