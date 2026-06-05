import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MusicianGroup } from "@/lib/musician-roles";

type Props = {
  groups: MusicianGroup[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
};

export function MusicianMultiSelect({ groups, value, onChange, placeholder = "Selecionar…", emptyText = "Nada encontrado." }: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  const labelFor = (v: string) => {
    for (const g of groups) {
      const o = g.options.find((o) => o.value === v);
      if (o) return o.label;
    }
    return v;
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open}
            className="w-full justify-between font-normal">
            <span className="text-muted-foreground">
              {value.length === 0 ? placeholder : `${value.length} selecionado${value.length > 1 ? "s" : ""}`}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar…" />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>{emptyText}</CommandEmpty>
              {groups.map((g, idx) => (
                <div key={g.label}>
                  {idx > 0 && <CommandSeparator />}
                  <CommandGroup heading={g.label}>
                    {g.options.map((o) => {
                      const selected = value.includes(o.value);
                      return (
                        <CommandItem key={o.value} value={`${g.label} ${o.label}`} onSelect={() => toggle(o.value)}>
                          <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                          {o.label}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-gold-soft text-gold text-[11px] px-2.5 py-1">
              {labelFor(v)}
              <button type="button" onClick={() => remove(v)} className="hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
