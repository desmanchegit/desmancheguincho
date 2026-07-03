import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, User, Mail, Phone, Calendar, ShoppingBag,
  Handshake, CheckCircle2, XCircle, MessageSquare,
  Star, Package, Loader2, Car, AlertTriangle,
} from "lucide-react";

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Aberto", color: "bg-blue-100 text-blue-700" },
  in_negotiation: { label: "Em Negociação", color: "bg-orange-100 text-orange-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  expired: { label: "Expirado", color: "bg-gray-100 text-gray-500" },
};

const NEG_STATUS: Record<string, { label: string; color: string }> = {
  negotiating: { label: "Negociando", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "Enviado", color: "bg-orange-100 text-orange-700" },
  awaiting_review: { label: "Aguard. Avaliação", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

function fmt(val: number | string | null) {
  if (!val) return "—";
  const d = typeof val === "number" ? new Date(val * 1000) : new Date(val);
  return d.toLocaleDateString("pt-BR");
}

function fmtMoney(val: number | null) {
  if (!val) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

function memberSince(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Há 1 dia";
  if (diffDays < 30) return `Há ${diffDays} dias`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `Há ${months} mês${months > 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  return `Há ${years} ano${years > 1 ? "s" : ""}`;
}

export default function ClientDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: u, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["/api/admin/users", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${id}`);
      return res.json();
    },
    retry: 2,
    retryDelay: 800,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !u) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="h-10 w-10 text-yellow-500" />
        <p className="text-slate-500 text-sm">Erro ao carregar dados do usuário.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={() => refetch()} size="sm">Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const stats = u.stats || {};
  const orders = u.orders || [];
  const negotiations = u.negotiations || [];

  const conversionRate = stats.totalOrders > 0
    ? Math.round((stats.totalCompleted / stats.totalOrders) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-lg">{initials(u.name || "U")}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold font-mono tracking-tight">{u.name}</h1>
              <Badge variant="outline" className="text-xs">
                {u.type === "admin" ? "Admin" : u.type === "desmanche" ? "Desmanche" : "Cliente"}
              </Badge>
            </div>
            <p className="text-slate-500 text-sm flex items-center gap-1 mt-0.5">
              <Calendar className="h-3.5 w-3.5" /> Membro {memberSince(u.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Anúncios", value: stats.totalOrders ?? 0, icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Com Propostas", value: stats.totalWithProposals ?? 0, icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Em Negociação", value: stats.totalNegotiating ?? 0, icon: Handshake, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Fechados", value: stats.totalCompleted ?? 0, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Cancelados", value: stats.totalCancelled ?? 0, icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border shadow-sm">
            <CardContent className={`pt-4 pb-3 px-4 rounded-lg`}>
              <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="text-2xl font-bold font-mono">{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Info + taxa */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-blue-500" />Dados do Usuário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate">{u.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>{u.phone || u.whatsapp || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Cadastro em {fmt(u.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Taxa de conversão */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" />Desempenho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Taxa de fechamento</span>
                  <span className="font-bold text-slate-700">{conversionRate}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${conversionRate}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Anúncios c/ resposta</span>
                <span className="font-bold">
                  {stats.totalOrders > 0
                    ? Math.round((stats.totalWithProposals / stats.totalOrders) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Total negociações</span>
                <span className="font-bold">{negotiations.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Orders + Negotiations */}
        <div className="lg:col-span-2 space-y-4">
          {/* Anúncios */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                Anúncios ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum anúncio publicado.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {orders.map((o: any) => {
                    const st = ORDER_STATUS[o.status] || { label: o.status, color: "bg-slate-100 text-slate-600" };
                    return (
                      <div key={o.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{o.title}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Car className="h-3 w-3" />
                            {[o.vehicleBrand, o.vehicleModel, o.vehicleYear].filter(Boolean).join(" · ") || "Veículo não informado"}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full block ${st.color}`}>{st.label}</span>
                          {o.proposalCount > 0 && (
                            <span className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                              <MessageSquare className="h-3 w-3" />{o.proposalCount} proposta{o.proposalCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Negociações */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Handshake className="h-4 w-4 text-orange-500" />
                Negociações ({negotiations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {negotiations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhuma negociação ainda.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {negotiations.map((n: any) => {
                    const st = NEG_STATUS[n.status] || { label: n.status, color: "bg-slate-100 text-slate-600" };
                    return (
                      <div key={n.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{n.orderTitle || "Pedido sem título"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">Desmanche:</span>
                            <span className="text-xs font-medium text-slate-700">{n.desmancheName || "—"}</span>
                            {n.desmancheRating != null && (
                              <span className="flex items-center gap-0.5 text-xs text-yellow-600">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                {Number(n.desmancheRating).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          {n.agreedPrice && (
                            <p className="text-sm font-bold text-emerald-600">{fmtMoney(n.agreedPrice)}</p>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full block ${st.color}`}>{st.label}</span>
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
