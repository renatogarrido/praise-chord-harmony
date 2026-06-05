import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listChurchesPublic, type ChurchOption } from "@/lib/churches.functions";

interface ChurchSelectProps {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

let cache: ChurchOption[] | null = null;

export function ChurchSelect({
  value,
  onChange,
  placeholder = "Selecione sua igreja…",
  className,
  id,
}: ChurchSelectProps) {
  const fetchChurches = useServerFn(listChurchesPublic);
  const [open, setOpen] = useState(false);
  const [churches, setChurches] = useState<ChurchOption[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let active = true;
    (async () => {
      try {
        const data = await fetchChurches();
        if (!active) return;
        cache = data;
        setChurches(data);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchChurches]);

  const selected = churches.find((c) => c.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </span>
          ) : selected ? (
            <span className="truncate">
              {selected.name}
              {selected.city ? ` — ${selected.city}${selected.state ? `/${selected.state}` : ""}` : ""}
            </span>
          ) : value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Buscar igreja…" />
          <CommandList>
            <CommandEmpty>Nenhuma igreja encontrada.</CommandEmpty>
            <CommandGroup>
              {churches.map((c) => {
                const label = `${c.name}${c.city ? ` — ${c.city}${c.state ? `/${c.state}` : ""}` : ""}`;
                return (
                  <CommandItem
                    key={c.id}
                    value={label}
                    onSelect={() => {
                      onChange(c.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === c.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
