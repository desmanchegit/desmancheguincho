import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Search, ChevronRight, Loader2, AlertTriangle, Building2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ALERT_DAYS = 30;
const EXPIRY_DOC_TYPES = ["alvara", "credenciamento_detran"];

const VEHICLE_TYPES = [
  { id: "carros", label: "Carros" },
  { id: "motos", label: "Motos" },
  { id: "caminhoes", label: "Caminhões" },
  { id: "tratores", label: "Tratores" },
];

function getDaysUntilExpiry(validUntil: number | null | undefined): number | null {
  if (!validUntil) return null;
  const now = Date.now();
  return Math.floor((validUntil * 1000 - now) / (1000 * 60 * 60 * 24));
}

function hasExpiringDocs(documents: any[]): { expiring: boolean; expired: boolean; label: string } {
  const relevant = (documents || []).filter((d: any) => EXPIRY_DOC_TYPES.includes(d.type) && d.validUntil);
  const days = relevant.map((d: any) => ({ doc: d, daysLeft: getDaysUntilExpiry(d.validUntil) }));
  const expired = days.filter((x) => x.daysLeft !== null && x.daysLeft < 0);
  const expiring = days.filter((x) => x.daysLeft !== null && x.daysLeft >= 0 && x.daysLeft <= ALERT_DAYS);

  if (expired.length > 0) {
    const names = expired.map((x) => x.doc.type === "alvara" ? "Alvará" : "Detran").join(", ");
    return { expiring: true, expired: true, label: `Vencido: ${names}` };
  }
  if (expiring.length > 0) {
    const minDays = Math.min(...expiring.map((x) => x.daysLeft as number));
    const names = expiring.map((x) => x.doc.type === "alvara" ? "Alvará" : "Detran").join(", ");
    return { expiring: true, expired: false, label: `A vencer em ${minDays}d: ${names}` };
  }
  return { expiring: false, expired: false, label: "" };
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
    pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
    rejected: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
    inactive: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
  };
  const labelMap: Record<string, string> = {
    active: "Ativo",
    pending: "Pendente",
    rejected: "Rejeitado",
    inactive: "Inativo",
  };
  return (
    <Badge variant="secondary" className={map[status] || ""}>
      {labelMap[status] || status}
    </Badge>
  );
}

const EMPTY_FORM = {
  companyName: "", tradingName: "", cnpj: "", email: "", phone: "",
  password: "", responsibleName: "", responsibleCpf: "",
  zipCode: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
};

export default function DesmanchesTab({ onSelectDesmanche }: { onSelectDesmanche?: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>([]);
  const [showPw, setShowPw] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<"idle" | "found" | "error">("idle");
  const { toast } = useToast();

  const formatPhone = (raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`;
    return clean;
  };

  const fetchCnpj = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return;
    setCnpjLoading(true);
    setCnpjStatus("idle");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();

      const phone = data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : "";
      const cepFormatted = data.cep ? data.cep.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") : "";
      const responsible = data.qsa?.[0];

      setForm((prev) => ({
        ...prev,
        companyName:     data.razao_social                    || prev.companyName,
        tradingName:     data.nome_fantasia || data.razao_social || prev.tradingName,
        phone:           phone                                || prev.phone,
        zipCode:         cepFormatted                         || prev.zipCode,
        street:          data.logradouro                      || prev.street,
        number:          data.numero                          || prev.number,
        complement:      data.complemento                     || prev.complement,
        neighborhood:    data.bairro                          || prev.neighborhood,
        city:            data.municipio                       || prev.city,
        state:           data.uf                              || prev.state,
        responsibleName: responsible?.nome_socio              || prev.responsibleName,
      }));
      setCnpjStatus("found");
    } catch {
      setCnpjStatus("error");
    } finally {
      setCnpjLoading(false);
    }
  };

  const fetchCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          street:       data.logradouro || "",
          neighborhood: data.bairro     || "",
          city:         data.localidade || "",
          state:        data.uf         || "",
        }));
      }
    } catch {}
  };

  const { data: desmanches = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/desmanches"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/desmanches");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, vehicleTypes: selectedVehicleTypes };
      const res = await apiRequest("POST", "/api/admin/create-desmanche", payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao criar desmanche");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/desmanches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setOpen(false);
      setForm(EMPTY_FORM);
      setSelectedVehicleTypes([]);
      setCnpjStatus("idle");
      toast({ title: "Desmanche cadastrado!", description: "O desmanche foi criado e já está ativo na plataforma." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const set = (field: keyof typeof EMPTY_FORM, value: string) => setForm((p) => ({ ...p, [field]: value }));
  const toggleVt = (id: string) =>
    setSelectedVehicleTypes((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]);

  const canSubmit = form.companyName && form.tradingName && form.cnpj && form.email && form.phone && form.password.length >= 6;

  const filtered = desmanches.filter((d: any) => {
    const matchesSearch =
      !search ||
      (d.tradingName || d.companyName || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.cnpj || "").includes(search);
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const expiringCount = desmanches.filter((d: any) => hasExpiringDocs(d.documents || []).expiring).length;

  const statuses = ["all", "active", "pending", "rejected", "inactive"];
  const statusLabels: Record<string, string> = {
    all: "Todos",
    active: "Ativos",
    pending: "Pendentes",
    rejected: "Rejeitados",
    inactive: "Inativos",
  };

  return (
    <div data-tour="admin-desmanches-content" className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Desmanches Credenciados</h1>
          <p className="text-muted-foreground">Gerencie as empresas ativas na plataforma.</p>
        </div>
        <div className="flex items-center gap-3">
          {expiringCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              {expiringCount} desmanche{expiringCount !== 1 ? "s" : ""} com documentação próxima do vencimento
            </div>
          )}
          <Button onClick={() => setOpen(true)} className="gap-2 shrink-0" data-testid="button-novo-desmanche">
            <Building2 className="h-4 w-4" /> Novo Desmanche
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Badge
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setStatusFilter(s)}
          >
            {statusLabels[s]}
          </Badge>
        ))}
      </div>

      <Card className="border-2">
        <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Total: <span className="font-bold text-foreground">{filtered.length}</span> desmanches
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum desmanche encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-6">ID</TableHead>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documentação</TableHead>
                  <TableHead className="text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d: any) => {
                  const location = d.address
                    ? `${d.address.city || ""}, ${d.address.state || ""}`.replace(/^, |, $/g, "")
                    : "—";
                  const docAlert = hasExpiringDocs(d.documents || []);
                  return (
                    <TableRow
                      key={d.id}
                      className={`cursor-pointer hover:bg-muted/60 transition-colors ${docAlert.expiring ? "bg-red-50/40" : ""}`}
                      onClick={() => onSelectDesmanche?.(d.id)}
                    >
                      <TableCell className="pl-6 font-mono text-xs text-muted-foreground">D-{String(d.id).slice(0, 8)}</TableCell>
                      <TableCell className="font-medium">{d.tradingName || d.companyName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{d.cnpj || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{location}</TableCell>
                      <TableCell>{d.plan || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500">★</span>
                          <span className="font-medium">{d.rating ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(d.status)}</TableCell>
                      <TableCell>
                        {docAlert.expiring ? (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className={`h-4 w-4 shrink-0 ${docAlert.expired ? "text-red-600" : "text-orange-500"}`} />
                            <span className={`text-xs font-semibold ${docAlert.expired ? "text-red-600" : "text-orange-600"}`}>
                              {docAlert.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Novo Desmanche */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(EMPTY_FORM); setSelectedVehicleTypes([]); setCnpjStatus("idle"); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Desmanche</DialogTitle>
            <DialogDescription>
              O desmanche será criado já ativo e poderá fazer login imediatamente. Documentos podem ser adicionados depois.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">

            {/* ── PASSO 1: CNPJ com auto-fill ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                1. CNPJ — Dados puxados automaticamente da Receita Federal
              </p>
              <div className="space-y-1.5">
                <Label>CNPJ <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={form.cnpj}
                    onChange={(e) => {
                      set("cnpj", e.target.value);
                      setCnpjStatus("idle");
                      fetchCnpj(e.target.value);
                    }}
                    className="pr-10"
                    data-testid="input-d-cnpj"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {cnpjLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!cnpjLoading && cnpjStatus === "found" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {!cnpjLoading && cnpjStatus === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    {!cnpjLoading && cnpjStatus === "idle" && <Search className="h-4 w-4 text-muted-foreground/40" />}
                  </span>
                </div>
                {cnpjStatus === "found" && (
                  <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3" /> Dados preenchidos automaticamente — confira e ajuste se necessário
                  </p>
                )}
                {cnpjStatus === "error" && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> CNPJ não encontrado na Receita Federal — preencha manualmente
                  </p>
                )}
              </div>
            </div>

            {/* ── Dados da empresa (auto-preenchidos) ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados da Empresa</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Razão Social <span className="text-destructive">*</span></Label>
                  <Input placeholder="Desmanches São Luís Ltda." value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)} data-testid="input-d-company" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome Fantasia <span className="text-destructive">*</span></Label>
                  <Input placeholder="Desmanche São Luís" value={form.tradingName}
                    onChange={(e) => set("tradingName", e.target.value)} data-testid="input-d-trading" />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone <span className="text-destructive">*</span></Label>
                  <Input placeholder="(51) 9 9999-9999" value={form.phone}
                    onChange={(e) => set("phone", e.target.value)} data-testid="input-d-phone" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome do Responsável</Label>
                  <Input placeholder="José da Silva" value={form.responsibleName}
                    onChange={(e) => set("responsibleName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF do Responsável</Label>
                  <Input placeholder="000.000.000-00" value={form.responsibleCpf}
                    onChange={(e) => set("responsibleCpf", e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Tipos de veículo ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tipos de Veículo Aceitos</p>
              <div className="flex flex-wrap gap-2">
                {VEHICLE_TYPES.map((vt) => (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={() => toggleVt(vt.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      selectedVehicleTypes.includes(vt.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {vt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Acesso ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Acesso à Plataforma</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>E-mail <span className="text-destructive">*</span></Label>
                  <Input type="email" placeholder="contato@desmanche.com.br" value={form.email}
                    onChange={(e) => set("email", e.target.value)} data-testid="input-d-email" />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                      value={form.password} onChange={(e) => set("password", e.target.value)}
                      data-testid="input-d-password" className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPw((p) => !p)}>
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Endereço (auto-preenchido pelo CNPJ; editável) ── */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Endereço <span className="text-xs font-normal normal-case text-muted-foreground">(preenchido automaticamente pelo CNPJ)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input
                    placeholder="00000-000"
                    value={form.zipCode}
                    onChange={(e) => {
                      set("zipCode", e.target.value);
                      fetchCep(e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Logradouro</Label>
                  <Input placeholder="Rua das Flores" value={form.street}
                    onChange={(e) => set("street", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input placeholder="123" value={form.number}
                    onChange={(e) => set("number", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Complemento</Label>
                  <Input placeholder="Sala 2" value={form.complement}
                    onChange={(e) => set("complement", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input placeholder="Centro" value={form.neighborhood}
                    onChange={(e) => set("neighborhood", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input placeholder="Porto Alegre" value={form.city}
                    onChange={(e) => set("city", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Input placeholder="RS" maxLength={2} value={form.state}
                    onChange={(e) => set("state", e.target.value.toUpperCase())} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => { setOpen(false); setForm(EMPTY_FORM); setSelectedVehicleTypes([]); setCnpjStatus("idle"); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                data-testid="button-d-submit"
              >
                {createMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</>
                  : "Criar desmanche"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
