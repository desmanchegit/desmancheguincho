import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PackageSearch, Clock, MapPin, Search, Loader2, User, Store, X, AlertTriangle,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getToken } from "@/lib/auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: string;
  title: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  city: string | null;
  state: string | null;
  location: string | null;
  status: string;
  createdAt: string;
  proposals?: { desmanche?: { tradingName?: string; companyName?: string } | null }[];
  client?: { name: string; email: string } | null;
};

type PendingNeg = {
  id: string;
  status: string;
  orderId: string;
  updatedAt: any;
  order?: { id: string; title: string; vehicleBrand?: string; vehicleModel?: string; vehicleYear?: string } | null;
  desmanche?: { id: string; tradingName?: string; companyName?: string } | null;
};

const statusLabels: Record<string, string> = {
  open: "Propostas Abertas",
  negotiating: "Em Negociação",
  completed: "Concluído",
  shipped: "Enviado",
  cancelled: "Cancelado",
  expired: "Expirado",
};

const statusStyles: Record<string, string> = {
  open: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
  negotiating: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
  closed: "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20",
  completed: "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
  shipped: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  cancelled: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
  expired: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
};

const pendingNegLabels: Record<string, { label: string; desc: string; color: string }> = {
  stale_awaiting_desmanche: {
    label: "Pendente — aguardando desmanche",
    desc: "O desmanche foi consultado sobre essa negociação parada e ainda não respondeu.",
    color: "bg-amber-100 text-amber-800 border-amber-300",
  },
  stale_awaiting_client: {
    label: "Pendente — aguardando cliente",
    desc: "O desmanche informou que nada aconteceu. Aguardando confirmação do cliente.",
    color: "bg-orange-100 text-orange-800 border-orange-300",
  },
};

function timeAgo(val: any): string {
  if (!val) return "—";
  const date = typeof val === "number" ? new Date(val * 1000) : new Date(val);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ontem";
  return `Há ${diffDays} dias`;
}

function getDesmancheNames(order: Order): string[] {
  if (!order.proposals) return [];
  const names = order.proposals
    .map((p) => p.desmanche?.tradingName || p.desmanche?.companyName || "")
    .filter(Boolean);
  return [...new Set(names)];
}

export default function OrdersTab({ onSelectOrder }: { onSelectOrder?: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const detectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/negotiations/detect-stale");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/negotiations/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: data.detected > 0 ? `${data.detected} negociação(ões) pendente(s) encontrada(s)!` : "Nenhuma negociação pendente encontrada.",
        description: data.detected > 0 ? "A lista foi atualizada." : "Todas as negociações estão dentro do prazo.",
      });
    },
    onError: () => toast({ title: "Erro ao verificar negociações", variant: "destructive" }),
  });

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/orders");
      return res.json();
    },
    enabled: !!getToken(),
    refetchInterval: 30 * 1000,
    staleTime: 0,
  });

  const { data: pendingNegs = [] } = useQuery<PendingNeg[]>({
    queryKey: ["/api/admin/negotiations/pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/negotiations/pending");
      return res.json();
    },
    enabled: !!getToken(),
    refetchInterval: 30 * 1000,
    staleTime: 0,
  });

  const filtered = orders.filter((order) => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const desmancheNames = getDesmancheNames(order);
      const match =
        order.title?.toLowerCase().includes(q) ||
        order.vehicleBrand?.toLowerCase().includes(q) ||
        order.vehicleModel?.toLowerCase().includes(q) ||
        String(order.id).toLowerCase().includes(q) ||
        order.client?.name?.toLowerCase().includes(q) ||
        order.client?.email?.toLowerCase().includes(q) ||
        desmancheNames.some((n) => n.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const countByStatus = (s: string) => orders.filter((o) => o.status === s).length;

  return (
    <div data-tour="admin-orders-content" className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Anúncios & Pedidos de Peças</h1>
          <p className="text-muted-foreground">Clique em um pedido para ver todo o histórico de propostas, negociações e conversas.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => detectMutation.mutate()}
          disabled={detectMutation.isPending}
          data-testid="button-detect-stale"
        >
          {detectMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <AlertTriangle className="h-4 w-4 text-amber-500" />}
          Verificar pendências
        </Button>
      </div>

      {/* ── Negociações Pendentes ───────────────────────────── */}
      {pendingNegs.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Negociações Pendentes
              <Badge className="bg-amber-500 text-white text-xs ml-1">{pendingNegs.length}</Badge>
            </CardTitle>
            <p className="text-xs text-amber-700">
              Essas negociações estão paradas há muito tempo e aguardam resposta para serem resolvidas.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingNegs.map((neg) => {
              const cfg = pendingNegLabels[neg.status] || { label: neg.status, desc: "", color: "bg-slate-100 text-slate-700 border-slate-200" };
              const vehicle = [neg.order?.vehicleBrand, neg.order?.vehicleModel, neg.order?.vehicleYear].filter(Boolean).join(" ");
              const desmancheName = neg.desmanche?.tradingName || neg.desmanche?.companyName || "—";
              return (
                <div
                  key={neg.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${cfg.color}`}
                  onClick={() => onSelectOrder?.(neg.orderId)}
                  data-testid={`card-pending-neg-${neg.id}`}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs border-current">{cfg.label}</Badge>
                      <span className="font-mono text-xs opacity-70">NEG-{neg.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <p className="font-semibold text-sm truncate">{neg.order?.title || "Pedido sem título"}</p>
                    {vehicle && <p className="text-xs opacity-80">{vehicle}</p>}
                    <p className="text-xs opacity-75 flex items-center gap-1">
                      <Store className="h-3 w-3" /> {desmancheName}
                      <span className="mx-1">·</span>
                      <Clock className="h-3 w-3" /> última atualização {timeAgo(neg.updatedAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 border-current bg-white/60 hover:bg-white text-inherit">
                    Ver pedido
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={statusFilter === null ? "default" : "outline"}
          className={`text-sm py-1 px-3 cursor-pointer ${statusFilter === null ? "bg-primary" : ""}`}
          onClick={() => setStatusFilter(null)}
        >
          Todos ({orders.length})
        </Badge>
        {Object.entries(statusLabels).map(([key, label]) => {
          const count = countByStatus(key);
          if (count === 0) return null;
          return (
            <Badge
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              className={`text-sm py-1 px-3 cursor-pointer ${statusFilter === key ? "bg-primary" : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              {label} ({count})
            </Badge>
          );
        })}
      </div>

      <div className="relative w-full max-w-lg">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por peça, ID, cliente ou desmanche..."
          className="pl-9 pr-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-orders-search"
        />
        {search && (
          <button
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {search && (
        <p className="text-sm text-muted-foreground -mt-3">
          {filtered.length === 0 ? "Nenhum resultado." : `${filtered.length} pedido(s) encontrado(s).`}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? `Nenhum resultado para "${search}".` : "Nenhum pedido encontrado."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const vehicle = [order.vehicleBrand, order.vehicleModel, order.vehicleYear].filter(Boolean).join(" ");
            const location = [order.city, order.state].filter(Boolean).join(", ") || order.location || "";
            const proposalCount = order.proposals ? order.proposals.length : 0;
            const desmancheNames = getDesmancheNames(order);

            return (
              <Card
                key={order.id}
                className="overflow-hidden hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onSelectOrder?.(order.id)}
                data-testid={`card-order-${order.id}`}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row items-stretch">
                    <div className="bg-muted/40 px-4 py-4 sm:w-64 flex flex-col justify-center border-r gap-1 shrink-0">
                      <span className="font-mono text-xs text-muted-foreground">
                        PED-{String(order.id).slice(0, 8).toUpperCase()}
                      </span>
                      <span className="font-bold text-base leading-tight group-hover:text-primary transition-colors">
                        {order.title}
                      </span>
                      {vehicle && (
                        <Badge variant="secondary" className="w-fit text-xs mt-1">{vehicle}</Badge>
                      )}
                    </div>

                    <div className="flex-1 px-4 py-4 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 items-center">
                      {order.client && (
                        <div className="flex items-center gap-1.5 text-sm col-span-2 md:col-span-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{order.client.name}</span>
                        </div>
                      )}
                      {location && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{location}</span>
                        </div>
                      )}
                      {desmancheNames.length > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground col-span-2 md:col-span-1">
                          <Store className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-xs">
                            {desmancheNames.slice(0, 2).join(", ")}
                            {desmancheNames.length > 2 && ` +${desmancheNames.length - 2}`}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 px-4 py-4 sm:w-40 shrink-0 border-t sm:border-t-0 sm:border-l">
                      <Badge
                        className={statusStyles[order.status] || "bg-slate-500/10 text-slate-600"}
                        variant="outline"
                      >
                        {statusLabels[order.status] || order.status}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <PackageSearch className="h-3.5 w-3.5" />
                          <span className="font-bold text-primary">{proposalCount}</span>
                          <span>prop.</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(order.createdAt)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
