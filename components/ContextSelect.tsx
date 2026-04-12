"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CONTEXT_OPTIONS } from "@/lib/context/umd";
import { ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";

interface ContextSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const triggerClass =
  "focus-visible:ring-amber-400 flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-left text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2";

export function ContextSelect({ value, onChange }: ContextSelectProps) {
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    if (value === null) return null;
    return CONTEXT_OPTIONS.find((o) => o.value === value)?.label ?? null;
  }, [value]);

  const orderedCategories = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const o of CONTEXT_OPTIONS) {
      if (!seen.has(o.category)) {
        seen.add(o.category);
        out.push(o.category);
      }
    }
    return out;
  }, []);

  return (
    <div className="flex w-full gap-1">
      <div className="min-w-0 flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger type="button" className={triggerClass}>
            <span className="truncate">
              {value === null
                ? "None — general brainstorming"
                : (label ?? value)}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="border-neutral-700 w-[min(calc(100vw-2rem),28rem)] border bg-neutral-950 p-0 text-neutral-100 shadow-lg"
          >
            <Command className="bg-neutral-950 [&_[cmdk-group-heading]]:text-neutral-400">
              <CommandInput placeholder="Search UMD contexts..." />
              <CommandList>
                <CommandEmpty>No matching context found</CommandEmpty>
                {orderedCategories.map((category) => (
                  <CommandGroup
                    key={category}
                    heading={category}
                    className="text-neutral-100 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                  >
                    {CONTEXT_OPTIONS.filter((o) => o.category === category).map(
                      (o) => (
                        <CommandItem
                          key={o.value}
                          value={`${o.label} ${o.value}`}
                          onSelect={() => {
                            onChange(o.value);
                            setOpen(false);
                          }}
                          className="text-neutral-100 aria-selected:bg-neutral-800"
                        >
                          {o.label}
                        </CommandItem>
                      ),
                    )}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {value !== null ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="focus-visible:ring-amber-400 flex shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-2 text-neutral-400 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2"
          aria-label="Clear UMD context"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
