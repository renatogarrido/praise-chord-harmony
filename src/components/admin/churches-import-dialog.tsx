import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ESTADUAIS = [
  "Alphaville","Bahia","Campinas","Jundiaí","Litoral/SP","Osasco","Santana",
  "Santo André","SBC","Hall Mooca","Sul","Zona Leste","Pernambuco",
  "S.J. Rio Preto","Rio de Janeiro","Tremembé",
];

type ParsedRow = {
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  estadual: string | null;
  instagram: string | null;
};

// Try to match user header keys to our schema keys (PT/EN flexible)
const FIELD_ALIASES: Record<string, keyof ParsedRow> = {
  // name
  nome: "name", name: "name", igreja: "name", "nome da igreja": "name",
  // address
  endereco: "address", endereço: "address", address: "address", "endereço completo": "address", rua: "address",
  // city
  cidade: "city", city: "city",
  // state
  estado: "state", state: "state", uf: "state",
  // country
  pais: "country", país: "country", country: "country",
  // estadual
  estadual: "estadual", regional: "estadual", "estadual (regional)": "estadual",
  // instagram
  instagram: "instagram", insta: "instagram", "@": "instagram",
};

const normKey = (k: string) =>
  k.toString().trim().toLowerCase().replace(/^@/, "@").replace(/\s+/g, " ");

const normalizeEstadual = (raw: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.toString().trim();
  if (!trimmed) return null;
  const found = ESTADUAIS.find(
    (e) => e.toLowerCase() === trimmed.toLowerCase()
  );
  return found ?? trimmed;
};

function mapRow(raw: Record<string, any>): ParsedRow | null {
  const out: Partial<ParsedRow> = {};
  for (const k of Object.keys(raw)) {
    const key = normKey(k);
    const target = FIELD_ALIASES[key];
    if (!target) continue;
    const value = raw[k];
    const str = value === null || value === undefined ? "" : String(value).trim();
    (out as any)[target] = str || null;
  }
  if (!out.name || !out.address) return null;
  return {
    name: String(out.name).trim().slice(0, 255),
    address: String(out.address).trim().slice(0, 1000),
    city: out.city ? String(out.city).trim().slice(0, 150) : null,
    state: out.state ? String(out.state).trim().slice(0, 100) : null,
    country: out.country ? String(out.country).trim().slice(0, 100) : "Brasil",
    estadual: normalizeEstadual(out.estadual ?? null),
    instagram: out.instagram ? String(out.instagram).trim().slice(0, 255) : null,
  };
}

async function parseFile(file: File): Promise<Record<string, any>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data as Record<string, any>[]),
        error: (err) => reject(err),
      });
    });
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
  }
  throw new Error("Formato não suportado. Use CSV, XLSX ou XLS.");
}

export function ChurchesImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const reset = () => {
    setFile(null);
    setRows([]);
    setInvalidCount(0);
  };

  const handleFile = async (f: File | null) => {
    setFile(f);
    setRows([]);
    setInvalidCount(0);
    if (!f) return;
    setIsParsing(true);
    try {
      const raw = await parseFile(f);
      const parsed: ParsedRow[] = [];
      let invalid = 0;
      for (const r of raw) {
        const mapped = mapRow(r);
        if (mapped) parsed.push(mapped);
        else invalid++;
      }
      setRows(parsed);
      setInvalidCount(invalid);
      if (parsed.length === 0) {
        toast.error("Nenhuma linha válida encontrada. Verifique cabeçalhos: nome, endereço, cidade, estado, país, estadual, instagram.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao ler o arquivo.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setIsImporting(true);
    try {
      // Insert in chunks of 100
      const chunkSize = 100;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from("churches" as any).insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast.success(`${inserted} igreja(s) importada(s) com sucesso.`);
      onImported();
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao importar.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-gold text-gold hover:bg-gold-soft">
          <Upload className="h-4 w-4" /> Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Importar Igrejas</DialogTitle>
          <DialogDescription>
            Importação em massa via CSV, XLSX ou XLS. Cabeçalhos aceitos:{" "}
            <strong>nome, endereço, cidade, estado, país, estadual, instagram</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-muted-foreground flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              Para arquivos PDF, exporte para CSV ou Excel antes da importação (parsing automático de PDF não é confiável).
            </p>
          </div>

          {isParsing && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo arquivo...
            </p>
          )}

          {file && !isParsing && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {file.name.endsWith(".csv") ? (
                  <FileText className="h-4 w-4 text-gold" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-gold" />
                )}
                <span className="font-medium truncate">{file.name}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {rows.length} válida(s)
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="border-destructive text-destructive gap-1">
                    <AlertTriangle className="h-3 w-3" /> {invalidCount} ignorada(s)
                  </Badge>
                )}
              </div>
              {rows.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border border-border bg-background text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Nome</th>
                        <th className="text-left p-2">Estadual</th>
                        <th className="text-left p-2">Cidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-2 truncate max-w-[200px]">{r.name}</td>
                          <td className="p-2">{r.estadual ?? "—"}</td>
                          <td className="p-2">{r.city ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 8 && (
                    <p className="p-2 text-center text-muted-foreground">
                      ... e mais {rows.length - 8} linha(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={rows.length === 0 || isImporting}
              className="bg-gold hover:bg-gold/90 text-white gap-2"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Importar {rows.length > 0 ? `(${rows.length})` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
