import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight, ChevronDown, Plus, Trash2, Star, FileText,
  Heading1, Heading2, Heading3, List, CheckSquare, Quote, Code, Minus, Search, Loader2, BookOpen,
  Image as ImageIcon, Upload,
} from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/app/admin/knowledge")({
  component: KnowledgePage,
});

type Scope = "personal" | "local" | "estadual" | "nacional" | "global";
type Block =
  | { id: string; type: "p" | "h1" | "h2" | "h3" | "bullet" | "quote" | "code"; text: string }
  | { id: string; type: "todo"; text: string; checked: boolean }
  | { id: string; type: "divider" }
  | { id: string; type: "image"; url: string; caption?: string };

type Page = {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  content: Block[];
  scope: Scope;
  church_name: string | null;
  estadual: string | null;
  owner_id: string;
  position: number;
  updated_at: string;
  category: string | null;
  department: string | null;
};

const SCOPE_LABEL: Record<Scope, string> = {
  personal: "Pessoal",
  local: "Igreja Local",
  estadual: "Estadual",
  nacional: "Nacional",
  global: "Global",
};

const newId = () => crypto.randomUUID();

function KnowledgePage() {
  const { user, isAdmin, roles } = useAuth();
  const isNacional = roles.includes("lider_nacional");
  const isEstadual = roles.includes("lider_estadual");
  const isLocal = roles.includes("lider_local");
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [myProfile, setMyProfile] = useState<{ church_name: string | null; estadual: string | null } | null>(null);

  // Load profile + estadual derived from church
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles").select("church_name").eq("id", user.id).maybeSingle();
      let estadual: string | null = null;
      if (prof?.church_name) {
        const { data: ch } = await supabase
          .from("churches").select("estadual").eq("name", prof.church_name).maybeSingle();
        estadual = ch?.estadual ?? null;
      }
      setMyProfile({ church_name: prof?.church_name ?? null, estadual });
    })();
  }, [user]);

  const reload = async () => {
    setLoading(true);
    const [{ data: pg }, { data: fv }] = await Promise.all([
      supabase.from("knowledge_pages").select("*").order("position").order("created_at"),
      supabase.from("knowledge_favorites").select("page_id").eq("user_id", user!.id),
    ]);
    setPages((pg ?? []) as any);
    setFavorites(new Set((fv ?? []).map((f: any) => f.page_id)));
    setLoading(false);
  };

  useEffect(() => { if (user) reload(); /* eslint-disable-next-line */ }, [user]);

  const tree = useMemo(() => buildTree(pages), [pages]);
  const selected = pages.find((p) => p.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return pages.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      JSON.stringify(p.content).toLowerCase().includes(q)
    );
  }, [search, pages]);

  const allowedScopes: Scope[] = useMemo(() => {
    const list: Scope[] = ["personal"];
    if (isAdmin) list.push("local", "estadual", "nacional", "global");
    else if (isNacional) list.push("local", "estadual", "nacional");
    else if (isEstadual) list.push("local", "estadual");
    else if (isLocal) list.push("local");
    return list;
  }, [isAdmin, isNacional, isEstadual, isLocal]);

  const createPage = async (parent_id: string | null, scope: Scope = "personal") => {
    const payload: any = {
      parent_id,
      title: "Nova página",
      content: [{ id: newId(), type: "p", text: "" }],
      scope,
      owner_id: user!.id,
      church_name: scope === "local" ? myProfile?.church_name ?? null : null,
      estadual: scope === "estadual" ? myProfile?.estadual ?? null : null,
    };
    const { data, error } = await supabase.from("knowledge_pages").insert(payload).select("*").single();
    if (error) { toast.error("Erro ao criar página", { description: error.message }); return; }
    setPages((prev) => [...prev, data as any]);
    setSelectedId((data as any).id);
  };

  const updatePage = async (id: string, patch: Partial<Page>) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } as Page : p)));
    const { error } = await supabase.from("knowledge_pages").update(patch as any).eq("id", id);
    if (error) toast.error("Erro ao salvar", { description: error.message });
  };

  const deletePage = async (id: string) => {
    if (!confirm("Excluir esta página e todas as subpáginas?")) return;
    const { error } = await supabase.from("knowledge_pages").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    setPages((prev) => prev.filter((p) => p.id !== id && p.parent_id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const toggleFavorite = async (id: string) => {
    const has = favorites.has(id);
    const next = new Set(favorites);
    if (has) {
      next.delete(id);
      await supabase.from("knowledge_favorites").delete().eq("user_id", user!.id).eq("page_id", id);
    } else {
      next.add(id);
      await supabase.from("knowledge_favorites").insert({ user_id: user!.id, page_id: id });
    }
    setFavorites(next);
  };

  if (!user) return null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-lg">Base</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..." className="pl-7 h-9 text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="grid place-items-center py-10"><Loader2 className="h-4 w-4 animate-spin text-gold" /></div>
          ) : filtered ? (
            <div className="space-y-1">
              {filtered.length === 0 && <p className="text-xs text-muted-foreground p-2">Nada encontrado.</p>}
              {filtered.map((p) => (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 ${selectedId === p.id ? "bg-accent text-gold" : ""}`}>
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{p.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {favorites.size > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-1">Favoritos</p>
                  {pages.filter((p) => favorites.has(p.id)).map((p) => (
                    <button key={p.id} onClick={() => setSelectedId(p.id)}
                      className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 ${selectedId === p.id ? "bg-accent text-gold" : ""}`}>
                      <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" />
                      <span className="truncate">{p.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {(["personal", "local", "estadual", "nacional", "global"] as Scope[]).map((scope) => {
                const roots = tree.filter((n) => n.page.scope === scope);
                if (roots.length === 0 && !allowedScopes.includes(scope)) return null;
                return (
                  <div key={scope} className="mb-3">
                    <div className="flex items-center justify-between px-2 mb-1">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{SCOPE_LABEL[scope]}</p>
                      {allowedScopes.includes(scope) && (
                        <button onClick={() => createPage(null, scope)} className="text-muted-foreground hover:text-gold">
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {roots.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 px-2">Sem páginas.</p>
                    ) : (
                      groupByDeptCat(roots).map((group) => (
                        <div key={group.key} className="mb-2">
                          {(group.department || group.category) && (
                            <p className="text-[10px] text-muted-foreground/70 px-2 mt-1 mb-0.5 font-medium">
                              {[group.department, group.category].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {group.nodes.map((node) => (
                            <TreeNode key={node.page.id} node={node} depth={0}
                              selectedId={selectedId} onSelect={setSelectedId}
                              onAddChild={(pid) => createPage(pid, node.page.scope)} />
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </aside>

      {/* Editor */}
      <section className="flex-1 min-w-0 overflow-y-auto">
        {selected ? (
          <PageEditor
            key={selected.id}
            page={selected}
            allowedScopes={allowedScopes}
            isFavorite={favorites.has(selected.id)}
            canEdit={canEditPage(selected, user.id, { isAdmin, isNacional, isEstadual, isLocal }, myProfile)}
            onChange={(patch) => updatePage(selected.id, patch)}
            onDelete={() => deletePage(selected.id)}
            onToggleFavorite={() => toggleFavorite(selected.id)}
            onAddChild={() => createPage(selected.id, selected.scope)}
          />
        ) : (
          <div className="grid place-items-center h-full p-10 text-center">
            <div>
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Selecione ou crie uma página para começar.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Tree helpers ----------
type Node = { page: Page; children: Node[] };
function buildTree(pages: Page[]): Node[] {
  const map = new Map<string, Node>();
  pages.forEach((p) => map.set(p.id, { page: p, children: [] }));
  const roots: Node[] = [];
  pages.forEach((p) => {
    const node = map.get(p.id)!;
    if (p.parent_id && map.has(p.parent_id)) map.get(p.parent_id)!.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function groupByDeptCat(nodes: Node[]): { key: string; department: string | null; category: string | null; nodes: Node[] }[] {
  const map = new Map<string, { department: string | null; category: string | null; nodes: Node[] }>();
  for (const n of nodes) {
    const dep = n.page.department || null;
    const cat = n.page.category || null;
    const key = `${dep ?? ""}|${cat ?? ""}`;
    if (!map.has(key)) map.set(key, { department: dep, category: cat, nodes: [] });
    map.get(key)!.nodes.push(n);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => {
      // Untagged ("" |"") goes last
      const aEmpty = !a.department && !a.category;
      const bEmpty = !b.department && !b.category;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      return (a.department ?? "").localeCompare(b.department ?? "") ||
             (a.category ?? "").localeCompare(b.category ?? "");
    });
}



function TreeNode({ node, depth, selectedId, onSelect, onAddChild }: {
  node: Node; depth: number; selectedId: string | null;
  onSelect: (id: string) => void; onAddChild: (pid: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const has = node.children.length > 0;
  return (
    <div>
      <div
        className={`group flex items-center gap-1 text-sm px-1 py-1 rounded hover:bg-accent ${selectedId === node.page.id ? "bg-accent text-gold" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button onClick={() => setOpen(!open)} className="w-4 h-4 grid place-items-center text-muted-foreground">
          {has ? (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <span className="h-3 w-3" />}
        </button>
        <button onClick={() => onSelect(node.page.id)} className="flex-1 text-left truncate flex items-center gap-1.5">
          <span>{node.page.icon || "📄"}</span>
          <span className="truncate">{node.page.title}</span>
        </button>
        <button onClick={() => onAddChild(node.page.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-gold">
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {open && has && node.children.map((c) => (
        <TreeNode key={c.page.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onAddChild={onAddChild} />
      ))}
    </div>
  );
}

function canEditPage(p: Page, uid: string, roles: { isAdmin: boolean; isNacional: boolean; isEstadual: boolean; isLocal: boolean }, prof: { church_name: string | null; estadual: string | null } | null) {
  if (p.scope === "personal") return p.owner_id === uid;
  if (p.scope === "global") return roles.isAdmin;
  if (p.scope === "nacional") return roles.isAdmin || roles.isNacional;
  if (p.scope === "estadual") return roles.isAdmin || roles.isNacional || (roles.isEstadual && p.estadual === prof?.estadual);
  if (p.scope === "local") return roles.isAdmin || roles.isNacional ||
    (roles.isEstadual && p.estadual === prof?.estadual) ||
    (roles.isLocal && p.church_name === prof?.church_name);
  return false;
}

// ---------- Page Editor ----------
function PageEditor({ page, allowedScopes, isFavorite, canEdit, onChange, onDelete, onToggleFavorite, onAddChild }: {
  page: Page; allowedScopes: Scope[]; isFavorite: boolean; canEdit: boolean;
  onChange: (patch: Partial<Page>) => void;
  onDelete: () => void; onToggleFavorite: () => void; onAddChild: () => void;
}) {
  const [localTitle, setLocalTitle] = useState(page.title);
  const [localIcon, setLocalIcon] = useState(page.icon || "📄");
  const [blocks, setBlocks] = useState<Block[]>(Array.isArray(page.content) && page.content.length ? page.content : [{ id: newId(), type: "p", text: "" }]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave of blocks
  useEffect(() => {
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onChange({ content: blocks });
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line
  }, [blocks]);

  const updateBlock = (id: string, patch: Partial<Block>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const deleteBlock = (id: string) =>
    setBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)));
  const addBlockAfter = (id: string, type: Block["type"]) => {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const nb = makeBlock(type);
      return [...prev.slice(0, i + 1), nb, ...prev.slice(i + 1)];
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-10 py-8">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <span className="px-2 py-0.5 rounded bg-muted">{SCOPE_LABEL[page.scope]}</span>
        {page.scope === "local" && page.church_name && <span>· {page.church_name}</span>}
        {page.scope === "estadual" && page.estadual && <span>· {page.estadual}</span>}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onToggleFavorite}>
            <Star className={`h-4 w-4 ${isFavorite ? "fill-gold text-gold" : ""}`} />
          </Button>
          {canEdit && (
            <>
              <Button variant="ghost" size="sm" onClick={onAddChild}>
                <Plus className="h-4 w-4" /> Subpágina
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 mb-6">
        <input value={localIcon} onChange={(e) => setLocalIcon(e.target.value.slice(0, 2))}
          onBlur={() => canEdit && localIcon !== page.icon && onChange({ icon: localIcon })}
          disabled={!canEdit}
          className="text-4xl w-14 bg-transparent border-none outline-none" />
        <input value={localTitle} onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={() => canEdit && localTitle !== page.title && onChange({ title: localTitle || "Sem título" })}
          disabled={!canEdit}
          placeholder="Sem título"
          className="flex-1 font-serif text-4xl bg-transparent border-none outline-none placeholder:text-muted-foreground/40" />
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
          <span className="text-muted-foreground">Visibilidade:</span>
          <Select value={page.scope} onValueChange={(v) => onChange({ scope: v as Scope })}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {allowedScopes.map((s) => <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            defaultValue={page.department ?? ""}
            placeholder="Departamento"
            className="h-8 w-40 text-xs"
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== (page.department ?? null)) onChange({ department: v } as any);
            }}
          />
          <Input
            defaultValue={page.category ?? ""}
            placeholder="Categoria"
            className="h-8 w-40 text-xs"
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== (page.category ?? null)) onChange({ category: v } as any);
            }}
          />
        </div>
      )}

      <div className="space-y-1">
        {blocks.map((b) => (
          <BlockEditor key={b.id} block={b} disabled={!canEdit}
            onChange={(patch) => updateBlock(b.id, patch)}
            onDelete={() => deleteBlock(b.id)}
            onEnter={() => addBlockAfter(b.id, "p")}
            onChangeType={(t) => updateBlock(b.id, { type: t } as any)}
          />
        ))}
        {canEdit && (
          <div className="flex flex-wrap gap-1 pt-3 border-t border-border/30 mt-4">
            {([
              ["p", "Texto", FileText],
              ["h1", "H1", Heading1],
              ["h2", "H2", Heading2],
              ["h3", "H3", Heading3],
              ["bullet", "Lista", List],
              ["todo", "To-do", CheckSquare],
              ["quote", "Citação", Quote],
              ["code", "Código", Code],
              ["image", "Imagem", ImageIcon],
              ["divider", "Divisor", Minus],
            ] as const).map(([t, label, Icon]) => (
              <Button key={t} variant="ghost" size="sm"
                onClick={() => addBlockAfter(blocks[blocks.length - 1].id, t)}
                className="text-xs gap-1">
                <Icon className="h-3 w-3" /> {label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function makeBlock(type: Block["type"]): Block {
  if (type === "todo") return { id: newId(), type, text: "", checked: false };
  if (type === "divider") return { id: newId(), type };
  return { id: newId(), type, text: "" } as Block;
}

function BlockEditor({ block, disabled, onChange, onDelete, onEnter, onChangeType }: {
  block: Block; disabled: boolean;
  onChange: (patch: Partial<Block>) => void;
  onDelete: () => void; onEnter: () => void;
  onChangeType: (t: Block["type"]) => void;
}) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault();
      onEnter();
    } else if (e.key === "Backspace" && (block as any).text === "") {
      e.preventDefault();
      onDelete();
    }
  };

  if (block.type === "divider") {
    return (
      <div className="group flex items-center gap-2 py-2">
        <hr className="flex-1 border-border" />
        {!disabled && <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>}
      </div>
    );
  }

  const baseTextarea = "w-full bg-transparent border-none outline-none resize-none px-2 py-1 rounded hover:bg-accent/30 focus:bg-accent/30";
  const styles: Record<string, string> = {
    h1: "text-3xl font-serif font-semibold",
    h2: "text-2xl font-serif font-semibold",
    h3: "text-xl font-serif font-semibold",
    p: "text-base",
    bullet: "text-base pl-6 relative before:content-['•'] before:absolute before:left-2",
    quote: "text-base italic border-l-2 border-gold pl-3",
    code: "text-sm font-mono bg-muted/50 rounded p-3",
    todo: "text-base flex-1",
  };

  return (
    <div className="group flex items-start gap-1">
      {block.type === "todo" && (
        <input type="checkbox" disabled={disabled}
          checked={(block as any).checked}
          onChange={(e) => onChange({ checked: e.target.checked } as any)}
          className="mt-2.5 ml-2" />
      )}
      <Textarea
        value={(block as any).text}
        disabled={disabled}
        onChange={(e) => onChange({ text: e.target.value } as any)}
        onKeyDown={onKeyDown}
        placeholder={placeholderFor(block.type)}
        rows={1}
        className={`${baseTextarea} ${styles[block.type] ?? ""} ${(block as any).checked ? "line-through text-muted-foreground" : ""}`}
        style={{ minHeight: block.type === "code" ? 80 : undefined }}
      />
      {!disabled && (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 pt-1">
          <Select value={block.type} onValueChange={(v) => onChangeType(v as any)}>
            <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="p">Texto</SelectItem>
              <SelectItem value="h1">H1</SelectItem>
              <SelectItem value="h2">H2</SelectItem>
              <SelectItem value="h3">H3</SelectItem>
              <SelectItem value="bullet">Lista</SelectItem>
              <SelectItem value="todo">To-do</SelectItem>
              <SelectItem value="quote">Citação</SelectItem>
              <SelectItem value="code">Código</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function placeholderFor(t: Block["type"]) {
  switch (t) {
    case "h1": return "Título grande";
    case "h2": return "Título médio";
    case "h3": return "Subtítulo";
    case "quote": return "Citação";
    case "code": return "Código";
    case "todo": return "Tarefa";
    case "bullet": return "Item";
    default: return "Escreva algo...";
  }
}
