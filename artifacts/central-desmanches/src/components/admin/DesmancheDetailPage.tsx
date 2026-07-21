import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, FileText, Star,
  DollarSign, ShoppingBag, CheckCircle2, XCircle, Clock, AlertTriangle,
  User, Package, Loader2, ShieldCheck, ShieldOff, Ban, Edit3,
} from "lucide-react";

const NEG_STATUS: Record<string, { label: string; color: string }> = {
  negotiating: { label: "Negociando", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "Enviado", color: "bg-orange-100 text-orange-700" },
  awaiting_review: { label: "Aguard. Avaliação", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const TX_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  paid: { label: "Pago", color: "bg-green-100 text-green-700" },
  exempt: { label: "Isento", color: "bg-gray-100 text-gray-600" },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700" },
};

const DOC_LABELS: Record<string, string> = {
  cnpj_card: "Cartão CNPJ",
  contract: "Contrato Social",
  address_proof: "Comprovante de Endereço",
  owner_id: "RG/CPF do Responsável",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativo", cls: "bg-green-100 text-green-700 border-green-200" },
    pending: { label: "Pendente", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    rejected: { label: "Rejeitado", cls: "bg-red-100 text-red-700 border-red-200" },
    inactive: { label: "Inativo", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const s = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}
function fmtDate(ts: number | string | null) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString("pt-BR");
}

export default function DesmancheDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const { data: d, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["/api/admin/desmanches", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/desmanches/${id}`);
      return res.json();
    },
    retry: 2,
    retryDelay: 800,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/desmanches/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/desmanches", id] });
      qc.invalidateQueries({ queryKey: ["/api/admin/desmanches"] });
      toast({ title: "Status atualizado com sucesso!" });
      setConfirmAction(null);
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("PATCH", `/api/admin/desmanches/${id}`, payload);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Não foi possível atualizar o cadastro");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/desmanches", id] });
      qc.invalidateQueries({ queryKey: ["/api/admin/desmanches"] });
      setEditOpen(false);
      toast({ title: "Cadastro atualizado com sucesso!" });
    },
    onError: (error: Error) => toast({ title: "Erro ao atualizar cadastro", description: error.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !d) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="h-10 w-10 text-yellow-500" />
        <p className="text-slate-500 text-sm">Erro ao carregar dados do desmanche.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={() => refetch()} size="sm">Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const negotiations = d.negotiations || [];
  const reviews = d.reviews || [];
  const txs = d.billingTransactions || [];
  const docs = d.documents || [];

  const completedNegs = negotiations.filter((n: any) => n.status === "completed").length;
  const cancelledNegs = negotiations.filter((n: any) => n.status === "cancelled").length;
  const totalNegValue = negotiations
    .filter((n: any) => n.agreedPrice)
    .reduce((s: number, n: any) => s + (n.agreedPrice || 0), 0);

  const avgRating = reviews.length
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const STATUS_ACTIONS = [
    { status: "active", label: "Ativar", icon: ShieldCheck, cls: "bg-green-600 hover:bg-green-700 text-white", show: d.status !== "active" },
    { status: "inactive", label: "Suspender", icon: ShieldOff, cls: "bg-yellow-600 hover:bg-yellow-700 text-white", show: d.status === "active" },
    { status: "rejected", label: "Rejeitar", icon: Ban, cls: "bg-red-600 hover:bg-red-700 text-white", show: d.status !== "rejected" },
  ].filter(a => a.show);

  const openEditor = () => {
    let vehicleTypes: string[] = [];
    try { vehicleTypes = Array.isArray(d.vehicleTypes) ? d.vehicleTypes : JSON.parse(d.vehicleTypes || "[]"); } catch {}
    setEditForm({
      companyName: d.companyName || "", tradingName: d.tradingName || "", cnpj: d.cnpj || "",
      email: d.email || "", phone: d.phone || "", responsibleName: d.responsibleName || "", responsibleCpf: d.responsibleCpf || "",
      vehicleTypes,
      address: { zipCode: d.address?.zipCode || "", street: d.address?.street || "", number: d.address?.number || "", complement: d.address?.complement || "", city: d.address?.city || "", state: d.address?.state || "" },
    });
    setEditOpen(true);
  };

  const setEdit = (field: string, value: string) => setEditForm((current: any) => ({ ...current, [field]: value }));
  const setAddress = (field: string, value: string) => setEditForm((current: any) => ({ ...current, address: { ...current.address, [field]: value } }));

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight truncate">
              {d.tradingName || d.companyName}
            </h1>
            <StatusBadge status={d.status} />
          </div>
          <p className="text-slate-500 text-sm mt-0.5">{d.companyName} · CNPJ: {d.cnpj || "—"}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={openEditor}><Edit3 className="h-3.5 w-3.5 mr-1" />Editar dados</Button>
          {STATUS_ACTIONS.map(({ status, label, icon: Icon, cls }) => (
            confirmAction === status ? (
              <div key={status} className="flex gap-1">
                <Button size="sm" className={cls} onClick={() => statusMutation.mutate({ status })} disabled={statusMutation.isPending}>
                  {statusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
              </div>
            ) : (
              <Button key={status} size="sm" className={cls} onClick={() => setConfirmAction(status)}>
                <Icon className="h-3.5 w-3.5 mr-1" /> {label}
              </Button>
            )
          ))}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cadastro do desmanche</DialogTitle>
            <DialogDescription>As alterações ficam registradas no histórico administrativo. A senha não é alterada nesta tela.</DialogDescription>
          </DialogHeader>
          {editForm && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {[
              ["companyName", "Razão Social"], ["tradingName", "Nome Fantasia"], ["cnpj", "CNPJ"], ["email", "E-mail"],
              ["phone", "Telefone"], ["responsibleName", "Nome do Responsável"], ["responsibleCpf", "CPF do Responsável"],
            ].map(([field, label]) => <div key={field} className="space-y-1.5"><Label>{label}</Label><Input value={editForm[field]} onChange={(e) => setEdit(field, e.target.value)} /></div>)}
            <div className="sm:col-span-2 pt-2 border-t"><p className="text-sm font-semibold mb-3">Endereço</p></div>
            {[["zipCode", "CEP"], ["street", "Logradouro"], ["number", "Número"], ["complement", "Complemento"], ["city", "Cidade"], ["state", "Estado (UF)"]].map(([field, label]) => <div key={field} className="space-y-1.5"><Label>{label}</Label><Input maxLength={field === "state" ? 2 : undefined} value={editForm.address[field]} onChange={(e) => setAddress(field, field === "state" ? e.target.value.toUpperCase() : e.target.value)} /></div>)}
          </div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Negociações", value: negotiations.length, icon: ShoppingBag, color: "text-blue-600" },
          { label: "Concluídas", value: completedNegs, icon: CheckCircle2, color: "text-green-600" },
          { label: "Canceladas", value: cancelledNegs, icon: XCircle, color: "text-red-500" },
          { label: "Volume Total", value: totalNegValue ? fmt(totalNegValue) : "—", icon: DollarSign, color: "text-emerald-600" },
          { label: "Avaliação Média", value: avgRating ? `★ ${avgRating}` : "—", icon: Star, color: "text-yellow-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border shadow-sm">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />{label}
              </div>
              <div className="text-xl font-bold font-mono">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Info Geral */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-500" />Dados da Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Razão Social" value={d.companyName} />
              <Row label="Nome Fantasia" value={d.tradingName} />
              <Row label="CNPJ" value={d.cnpj} mono />
              <Row label="Plano" value={d.plan} />
              <Row label="Responsável" value={d.responsibleName} />
              <Row label="CPF Resp." value={d.responsibleCpf} mono />
              <Separator />
              <div className="flex items-center gap-2 text-slate-500">
                <Mail className="h-3.5 w-3.5" /><span className="truncate">{d.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Phone className="h-3.5 w-3.5" /><span>{d.phone || "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          {d.address && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-purple-500" />Endereço</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1 text-slate-600">
                <p>{d.address.street}{d.address.number ? `, ${d.address.number}` : ""}</p>
                {d.address.complement && <p className="text-slate-400">{d.address.complement}</p>}
                <p>{d.address.city} — {d.address.state}</p>
                <p className="font-mono text-xs text-slate-400">CEP: {d.address.zipCode}</p>
              </CardContent>
            </Card>
          )}

          {/* Documentação */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" />Documentação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {docs.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum documento enviado.</p>
              ) : docs.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">{DOC_LABELS[doc.type] || doc.type}</span>
                  <Badge variant="outline" className={doc.status === "approved" ? "border-green-300 text-green-600" : doc.status === "rejected" ? "border-red-300 text-red-600" : "border-yellow-300 text-yellow-600"}>
                    {doc.status === "approved" ? "Aprovado" : doc.status === "rejected" ? "Rejeitado" : "Pendente"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Avaliações */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" />Avaliações ({reviews.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-64 overflow-y-auto">
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-400">Sem avaliações ainda.</p>
              ) : reviews.map((r: any) => (
                <div key={r.id} className="border rounded p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">{fmtDate(r.createdAt)}</span>
                  </div>
                  {r.comment && <p className="text-xs text-slate-600">"{r.comment}"</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Financeiro */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" />Financeiro</CardTitle>
              <CardDescription className="text-xs">Cobranças geradas pela plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-xs text-slate-500 mb-1">Total Pago</p>
                  <p className="text-lg font-bold text-green-600">{fmt(d.totalPaid ?? 0)}</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <p className="text-xs text-slate-500 mb-1">Pendente</p>
                  <p className="text-lg font-bold text-yellow-600">{fmt(d.totalPending ?? 0)}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Modelo</p>
                  <p className="text-sm font-bold text-slate-700">{d.billing?.billingModel === "per_transaction" ? "Por Transação" : d.billing?.billingModel === "subscription" ? "Assinatura" : "—"}</p>
                </div>
              </div>

              {txs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhuma cobrança gerada ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b">
                        <th className="text-left py-2">Descrição</th>
                        <th className="text-right py-2">Valor</th>
                        <th className="text-center py-2">Status</th>
                        <th className="text-right py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((tx: any) => {
                        const st = TX_STATUS[tx.status] || { label: tx.status, color: "bg-slate-100 text-slate-600" };
                        return (
                          <tr key={tx.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="py-2 text-slate-600 max-w-[200px] truncate">{tx.description}</td>
                            <td className="py-2 text-right font-mono font-medium">{fmt(tx.amount)}</td>
                            <td className="py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${st.color}`}>{st.label}</span>
                            </td>
                            <td className="py-2 text-right text-slate-400">{fmtDate(tx.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Negociações */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-blue-500" />Negociações ({negotiations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {negotiations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhuma negociação ainda.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {negotiations.map((neg: any) => {
                    const st = NEG_STATUS[neg.status] || { label: neg.status, color: "bg-slate-100 text-slate-600" };
                    return (
                      <div key={neg.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{neg.order?.title || "Pedido sem título"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <User className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-500 truncate">{neg.client?.name || "—"}</span>
                            <Clock className="h-3 w-3 text-slate-400 ml-1" />
                            <span className="text-xs text-slate-400">{fmtDate(neg.createdAt)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {neg.agreedPrice && (
                            <p className="text-sm font-bold text-emerald-600">{fmt(neg.agreedPrice)}</p>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}:</span>
      <span className={`text-right text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</span>
    </div>
  );
}
