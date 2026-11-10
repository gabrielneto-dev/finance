"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// O painel trabalha com datas AAAA-MM-DD; o calendário, com Date no fuso local.
const toDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
};
const toText = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part, index) => String(part).padStart(index ? 2 : 4, "0")).join("-");
const display = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function DatePicker({ value, onChange, min, max, today, className, ...props }: {
  value: string; onChange: (value: string) => void; min?: string; max?: string; today?: string; className?: string;
} & Omit<React.ComponentProps<"button">, "value" | "onChange">) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);
  const [month, setMonth] = React.useState(selected);
  const first = min ? toDate(min) : undefined;
  const last = max ? toDate(max) : undefined;
  const current = today ? toDate(today) : new Date();
  const choose = (date: Date | undefined) => {
    if (!date) return;
    onChange(toText(date));
    setOpen(false);
  };
  const todayAllowed = current && (!first || current >= first) && (!last || current <= last);
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setMonth(selected); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("date-trigger justify-between bg-white font-medium text-foreground", className)} {...props}>
          {selected ? display.format(selected) : "Escolher data"}
          <CalendarDays className="opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar
          mode="single" required selected={selected} onSelect={choose} month={month} onMonthChange={setMonth}
          today={current} startMonth={first} endMonth={last}
          disabled={[...(first ? [{ before: first }] : []), ...(last ? [{ after: last }] : [])]}
        />
        <div className="flex justify-end border-t px-3 py-2">
          <Button variant="ghost" size="sm" disabled={!todayAllowed} onClick={() => choose(current)}>Hoje</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
