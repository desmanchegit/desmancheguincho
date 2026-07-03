import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Radio, Image as ImageIcon, Upload, Trash2, Search,
  CheckCircle2, AlertCircle, X, RefreshCw, Save, Database,
} from "lucide-react";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/auth";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface FipeBrand { codigo: string; nome: string; }
interface BrandLogo { id: string; brandId: string; brandName: string; logoUrl: string; vehicleType: string; }
interface SiteSettings { [key: string]: string; }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function uploadFile(file: File): Promise<string> {
  const token = getToken();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error("Upload falhou");
  return (await res.json()).url;
}

// ─── TICKER SECTION ──────────────────────────────────────────────────────────
function LiveStatusSection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
    queryFn: async () => { const r = await fetch("/api/site-settings"); return r.json(); },
    staleTime: 10000,
  });

  const [form, setForm] = useState({
    ticker_negotiating: "1.245",
    ticker_desmanches_online: "42",
    ticker_traded_today: "145.000",
    ticker_new_orders: "23",
    ticker_custom: "",
    ticker_use_real_data: "false",
  });

  const useRealData = form.ticker_use_real_data === "true";

  const { data: realStats } = useQuery<{ desmanchesOnline: number; clientsTotal: number; ordersToday: number; activeNegotiations: number }>({
    queryKey: ["/api/site-stats/real"],
    queryFn: async () => { const r = await fetch("/api/site-stats/real"); return r.json(); },
    staleTime: 30000,
  });

  useEffect(() => {
    if (settings) {
      setForm(prev => ({ ...prev, ...settings }));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: SiteSettings) => {
      const r = await apiRequest("PATCH", "/api/site-settings", data);
      return r.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["/api/site-settings"], data);
      toast({ title: "Live Status atualizado!" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const fields: { key: keyof typeof form; label: string; placeholder: string; hint: string }[] = [
    { key: "ticker_negotiating", label: "Pessoas negociando agora", placeholder: "1.245", hint: "Aparece como: X pessoas negociando agora" },
    { key: "ticker_desmanches_online", label: "Desmanches online", placeholder: "42", hint: "Aparece como: X desmanches online" },
    { key: "ticker_traded_today", label: "Valor negociado hoje (R$)", placeholder: "145.000", hint: "Aparece como: R$ X em peças negociadas hoje" },
    { key: "ticker_new_orders", label: "Novos pedidos de peças", placeholder: "23", hint: "Aparece como: X novos pedidos de peças" },
    { key: "ticker_custom", label: "Mensagem personalizada (opcional)", placeholder: "Promoção especial hoje!", hint: "Texto livre exibido no final do ticker. Deixe vazio para não exibir." },
  ];

  const previewText = [
    `${form.ticker_negotiating} pessoas negociando agora`,
    `${form.ticker_desmanches_online} desmanches online`,
    `R$ ${form.ticker_traded_today} em peças negociadas hoje`,
    `${form.ticker_new_orders} novos pedidos de peças`,
    form.ticker_custom,
  ].filter(Boolean).join("  |  ");

  const realPreviewText = realStats
    ? [
        `${realStats.activeNegotiations} negociações ativas`,
        `${realStats.desmanchesOnline} desmanches cadastrados`,
        `${realStats.ordersToday} pedidos hoje`,
        `${realStats.clientsTotal} clientes cadastrados`,
        ...(form.ticker_custom ? [form.ticker_custom] : []),
      ].join("  |  ")
    : "Carregando dados reais...";

  return (
    <div data-tour="admin-site-content" className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* Real Data Toggle */}
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${useRealData ? "border-green-300 bg-green-50" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex items-center gap-3">
              <Database className={`h-5 w-5 ${useRealData ? "text-green-600" : "text-slate-400"}`} />
              <div>
                <p className="text-sm font-semibold text-slate-800">Usar dados reais do banco</p>
                <p className="text-xs text-slate-500">
                  {useRealData
                    ? "O ticker exibe contagens reais do sistema (negociações, pedidos, etc.)"
                    : "O ticker exibe os números configurados manualmente abaixo."}
                </p>
              </div>
            </div>
            <Switch
              checked={useRealData}
              onCheckedChange={(checked) => setForm(prev => ({ ...prev, ticker_use_real_data: checked ? "true" : "false" }))}
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
            <div className="bg-slate-900 text-slate-300 px-4 py-1.5 text-xs font-mono flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE STATUS — pré-visualização {useRealData && <span className="text-green-400 ml-1">(dados reais)</span>}
            </div>
            <div className="bg-slate-950 text-white px-4 py-2.5 overflow-hidden">
              <p className="font-mono text-sm whitespace-nowrap text-slate-200 truncate">
                {useRealData ? realPreviewText : previewText}
              </p>
            </div>
          </div>

          {/* Fields — only shown in manual mode */}
          {!useRealData && (
            <div className="grid md:grid-cols-2 gap-4">
              {fields.map(({ key, label, placeholder, hint }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="font-medium">{label}</Label>
                  <Input
                    value={form[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                  <p className="text-xs text-slate-400">{hint}</p>
                </div>
              ))}
            </div>
          )}

          {/* Custom message always visible */}
          {useRealData && (
            <div className="space-y-1.5">
              <Label className="font-medium">Mensagem personalizada (opcional)</Label>
              <Input
                value={form.ticker_custom}
                onChange={e => setForm(prev => ({ ...prev, ticker_custom: e.target.value }))}
                placeholder="Promoção especial hoje!"
              />
              <p className="text-xs text-slate-400">Texto livre exibido no final do ticker. Deixe vazio para não exibir.</p>
            </div>
          )}

          {/* Real data summary */}
          {useRealData && realStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Negociações ativas", value: realStats.activeNegotiations },
                { label: "Desmanches ativos", value: realStats.desmanchesOnline },
                { label: "Pedidos hoje", value: realStats.ordersToday },
                { label: "Clientes", value: realStats.clientsTotal },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-center">
                  <p className="text-2xl font-bold text-green-700">{value}</p>
                  <p className="text-xs text-green-600 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Live Status
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── BRAND LOGOS SECTION ─────────────────────────────────────────────────────
function BrandLogosSection() {
  const { toast } = useToast();
  const qclient = useQueryClient();
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<"all" | "car" | "motorcycle" | "truck">("all");
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [bulkMatches, setBulkMatches] = useState<{ file: File; brand: FipeBrand; vType: string } | null>(null);
  const [bulkQueue, setBulkQueue] = useState<{ file: File; brand: FipeBrand; vType: string }[]>([]);
  const [bulkUnmatched, setBulkUnmatched] = useState<string[]>([]);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);

  const { data: savedLogos = [], isLoading: logosLoading } = useQuery<BrandLogo[]>({
    queryKey: ["/api/brand-logos"],
    queryFn: async () => { const r = await fetch("/api/brand-logos"); return r.json(); },
  });

  const savedLogoMap = new Map(savedLogos.map(l => [l.brandId, l]));

  const [allFipeBrands, setAllFipeBrands] = useState<(FipeBrand & { vehicleType: string })[]>([]);
  const [fipeLoading, setFipeLoading] = useState(false);
  const [fipeError, setFipeError] = useState(false);

  const fetchFipeBrands = async () => {
    setFipeLoading(true);
    setFipeError(false);
    try {
      const [cars, motos, trucks] = await Promise.all([
        fetch("https://parallelum.com.br/fipe/api/v1/carros/marcas").then(r => r.json()),
        fetch("https://parallelum.com.br/fipe/api/v1/motos/marcas").then(r => r.json()),
        fetch("https://parallelum.com.br/fipe/api/v1/caminhoes/marcas").then(r => r.json()),
      ]);
      const combined: (FipeBrand & { vehicleType: string })[] = [
        ...cars.map((b: FipeBrand) => ({ ...b, vehicleType: "car" })),
        ...motos.map((b: FipeBrand) => ({ ...b, vehicleType: "motorcycle" })),
        ...trucks.map((b: FipeBrand) => ({ ...b, vehicleType: "truck" })),
      ];
      // Deduplicate by nome
      const seen = new Set<string>();
      const unique = combined.filter(b => {
        const k = normalizeName(b.nome);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setAllFipeBrands(unique.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    } catch {
      setFipeError(true);
    } finally {
      setFipeLoading(false);
    }
  };

  useEffect(() => { fetchFipeBrands(); }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/brand-logos/${id}`);
    },
    onSuccess: () => {
      qclient.invalidateQueries({ queryKey: ["/api/brand-logos"] });
      toast({ title: "Logo removido" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  const uploadSingle = async (brand: FipeBrand & { vehicleType: string }, file: File) => {
    const key = brand.codigo + "_" + brand.vehicleType;
    setUploading(prev => new Set(prev).add(key));
    try {
      const url = await uploadFile(file);
      const token = getToken();
      await fetch("/api/brand-logos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandId: brand.codigo + "_" + brand.vehicleType, brandName: brand.nome, logoUrl: url, vehicleType: brand.vehicleType }),
      });
      qclient.invalidateQueries({ queryKey: ["/api/brand-logos"] });
      toast({ title: `Logo de "${brand.nome}" salvo!` });
    } catch {
      toast({ title: "Erro no upload", variant: "destructive" });
    } finally {
      setUploading(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const handleBulkSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const brandNormMap = new Map(allFipeBrands.map(b => [normalizeName(b.nome), b]));
    const matched: { file: File; brand: FipeBrand & { vehicleType: string }; vType: string }[] = [];
    const unmatched: string[] = [];
    for (const file of files) {
      const baseName = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[-_]/g, "");
      const normalized = normalizeName(baseName);
      // Try exact match, then partial
      let brand = brandNormMap.get(normalized);
      if (!brand) {
        for (const [k, b] of brandNormMap.entries()) {
          if (k.includes(normalized) || normalized.includes(k)) { brand = b; break; }
        }
      }
      if (brand) matched.push({ file, brand, vType: brand.vehicleType });
      else unmatched.push(file.name);
    }
    setBulkQueue(matched);
    setBulkUnmatched(unmatched);
    setBulkConfirming(true);
    // reset input
    if (bulkInputRef.current) bulkInputRef.current.value = "";
  };

  const confirmBulkUpload = async () => {
    setBulkUploading(true);
    let ok = 0; let fail = 0;
    for (const { file, brand, vType } of bulkQueue) {
      try {
        const url = await uploadFile(file);
        const token = getToken();
        await fetch("/api/brand-logos", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ brandId: brand.codigo + "_" + vType, brandName: brand.nome, logoUrl: url, vehicleType: vType }),
        });
        ok++;
      } catch { fail++; }
    }
    qclient.invalidateQueries({ queryKey: ["/api/brand-logos"] });
    setBulkUploading(false);
    setBulkConfirming(false);
    setBulkQueue([]);
    setBulkUnmatched([]);
    toast({ title: `${ok} logo(s) salvo(s)${fail > 0 ? `, ${fail} falharam` : ""}` });
  };

  const filteredBrands = allFipeBrands.filter(b => {
    if (vehicleTypeFilter !== "all" && b.vehicleType !== vehicleTypeFilter) return false;
    if (search && !b.nome.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const withLogo = filteredBrands.filter(b => savedLogoMap.has(b.codigo + "_" + b.vehicleType));
  const withoutLogo = filteredBrands.filter(b => !savedLogoMap.has(b.codigo + "_" + b.vehicleType));
  const displayBrands = [...withLogo, ...withoutLogo];

  const vtypeOptions: { value: "all" | "car" | "motorcycle" | "truck"; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "car", label: "Carros" },
    { value: "motorcycle", label: "Motos" },
    { value: "truck", label: "Caminhões" },
  ];

  return (
    <div className="space-y-4">
      {/* Bulk confirm dialog */}
      {bulkConfirming && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {bulkQueue.length} marca(s) identificada(s)
            </h4>
            <Button variant="ghost" size="icon" onClick={() => { setBulkConfirming(false); setBulkQueue([]); setBulkUnmatched([]); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {bulkQueue.map(({ file, brand }) => (
              <div key={file.name} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs">
                <img src={URL.createObjectURL(file)} alt="" className="w-7 h-7 object-contain rounded shrink-0" />
                <div className="overflow-hidden">
                  <p className="font-medium text-slate-700 truncate">{brand.nome}</p>
                  <p className="text-slate-400 truncate">{file.name}</p>
                </div>
              </div>
            ))}
          </div>
          {bulkUnmatched.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {bulkUnmatched.length} arquivo(s) não identificado(s):
              </p>
              <p className="text-xs text-amber-600">{bulkUnmatched.join(", ")}</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setBulkConfirming(false); setBulkQueue([]); setBulkUnmatched([]); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={confirmBulkUpload} disabled={bulkUploading || bulkQueue.length === 0} className="gap-2">
              {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {bulkUploading ? "Enviando..." : `Confirmar (${bulkQueue.length})`}
            </Button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar marca..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {vtypeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setVehicleTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                vehicleTypeFilter === opt.value ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          ref={bulkInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleBulkSelect}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkInputRef.current?.click()}
          disabled={allFipeBrands.length === 0}
          className="gap-2"
        >
          <Upload className="h-4 w-4" /> Upload em Massa
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchFipeBrands} disabled={fipeLoading} title="Recarregar marcas da FIPE">
          <RefreshCw className={`h-4 w-4 ${fipeLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {savedLogos.length} logo(s) cadastrado(s)
        </span>
        {fipeError && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertCircle className="h-3 w-3" /> Erro ao carregar marcas da FIPE
          </span>
        )}
        {!fipeError && !fipeLoading && <span>{allFipeBrands.length} marcas carregadas da FIPE</span>}
      </div>

      {/* Brand Grid */}
      {fipeLoading || logosLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {displayBrands.map(brand => {
            const key = brand.codigo + "_" + brand.vehicleType;
            const saved = savedLogoMap.get(key);
            const isUploading = uploading.has(key);
            return (
              <label
                key={key}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all group ${
                  saved ? "border-green-300 bg-green-50/50" : "border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) await uploadSingle(brand, file);
                    e.target.value = "";
                  }}
                />
                <div className="relative w-12 h-12 flex items-center justify-center">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : saved ? (
                    <img src={saved.logoUrl} alt={brand.nome} className="w-12 h-12 object-contain rounded" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors">
                      <Upload className="h-5 w-5" />
                    </div>
                  )}
                  {saved && !isUploading && (
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); deleteMutation.mutate(saved.id); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-700 leading-tight">{brand.nome}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                    {brand.vehicleType === "car" ? "Carro" : brand.vehicleType === "motorcycle" ? "Moto" : "Caminhão"}
                  </p>
                </div>
                {saved && <Badge className="text-[9px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">Logo cadastrado</Badge>}
              </label>
            );
          })}
          {displayBrands.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="h-10 w-10 mb-2 text-slate-200" />
              <p className="text-sm">Nenhuma marca encontrada.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN TAB ─────────────────────────────────────────────────────────────────
export default function SiteContentTab() {
  const [section, setSection] = useState<"ticker" | "logos">("ticker");

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Conteúdo do Site</h1>
        <p className="text-slate-500 mt-1">Configure o Live Status do ticker e gerencie as logomarcas das montadoras.</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setSection("ticker")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === "ticker" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Radio className="h-4 w-4" /> Live Status
        </button>
        <button
          onClick={() => setSection("logos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === "logos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <ImageIcon className="h-4 w-4" /> Logos das Marcas
        </button>
      </div>

      {section === "ticker" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> Configurar Live Status
            </CardTitle>
            <CardDescription>
              Edite os valores exibidos no ticker animado no topo do site e do painel admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <LiveStatusSection />
          </CardContent>
        </Card>
      )}

      {section === "logos" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Logos das Montadoras
            </CardTitle>
            <CardDescription>
              Cadastre os logotipos das marcas de veículos. As marcas são carregadas automaticamente da tabela FIPE.
              Para upload em massa, nomeie os arquivos com o nome da marca (ex: <code className="bg-slate-100 px-1 rounded">fiat.png</code>, <code className="bg-slate-100 px-1 rounded">volkswagen.png</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <BrandLogosSection />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
